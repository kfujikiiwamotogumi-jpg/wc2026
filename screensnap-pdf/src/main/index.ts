import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  globalShortcut,
  ipcMain,
  dialog,
  shell,
  screen,
  Display
} from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { IPC } from '@shared/ipc'
import { AppSettings, CaptureRect, OverlayInit } from '@shared/types'
import { getSettings, updateSettings } from './store'
import { captureRectToPdf } from './capture'
import { trayIcon } from './tray-icon'

let tray: Tray | null = null
let settingsWindow: BrowserWindow | null = null
/** 表示中のオーバーレイ。webContents.id → 担当ディスプレイID */
const overlays = new Map<BrowserWindow, number>()
let captureModeActive = false

// ---------------------------------------------------------------------------
// ウィンドウのページ読み込み（dev はデブサーバ、prod はファイル）
// ---------------------------------------------------------------------------
function loadPage(win: BrowserWindow, page: 'settings' | 'overlay'): void {
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/${page}.html`)
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}.html`))
  }
}

// ---------------------------------------------------------------------------
// 設定パネルウィンドウ（キャプチャーモード中の小ウィンドウ。仕様 4.）
// ---------------------------------------------------------------------------
function createSettingsWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 340,
    height: 460,
    show: false,
    frame: true,
    resizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    title: 'ScreenSnap PDF',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  win.removeMenu()
  loadPage(win, 'settings')
  win.on('close', (e) => {
    // ウィンドウを閉じてもアプリは常駐し続ける（トレイから終了する）。
    e.preventDefault()
    win.hide()
    if (captureModeActive) exitCaptureMode()
  })
  return win
}

function showSettingsWindow(): void {
  if (!settingsWindow || settingsWindow.isDestroyed()) {
    settingsWindow = createSettingsWindow()
  }
  settingsWindow.show()
  settingsWindow.focus()
}

// ---------------------------------------------------------------------------
// オーバーレイ（画面上のキャプチャ枠。各ディスプレイに 1 枚ずつ）
// ---------------------------------------------------------------------------
function createOverlayForDisplay(display: Display): BrowserWindow {
  const { x, y, width, height } = display.bounds
  const win = new BrowserWindow({
    x,
    y,
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    enableLargerThanScreen: true,
    fullscreenable: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      additionalArguments: [`--display-id=${display.id}`]
    }
  })
  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  loadPage(win, 'overlay')
  overlays.set(win, display.id)
  win.on('closed', () => overlays.delete(win))
  win.once('ready-to-show', () => win.show())
  return win
}

// ---------------------------------------------------------------------------
// キャプチャーモードの開始 / 終了（仕様 2. 操作フロー）
// ---------------------------------------------------------------------------
function enterCaptureMode(): void {
  if (captureModeActive) {
    // 既に入っている場合は設定パネルを前面に出すだけ。
    showSettingsWindow()
    return
  }
  captureModeActive = true
  for (const d of screen.getAllDisplays()) {
    createOverlayForDisplay(d)
  }
  showSettingsWindow()
  updateTrayMenu()
}

function exitCaptureMode(): void {
  if (!captureModeActive) return
  captureModeActive = false
  for (const win of [...overlays.keys()]) {
    if (!win.isDestroyed()) win.close()
  }
  overlays.clear()
  if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.hide()
  updateTrayMenu()
}

/** スクリーンショットに枠やパネルが写り込まないよう、撮影の瞬間だけ隠す */
async function withWindowsHidden<T>(fn: () => Promise<T>): Promise<T> {
  const toRestore: BrowserWindow[] = []
  for (const win of overlays.keys()) {
    if (!win.isDestroyed() && win.isVisible()) {
      win.hide()
      toRestore.push(win)
    }
  }
  if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) {
    settingsWindow.hide()
    toRestore.push(settingsWindow)
  }
  // コンポジタが再描画するのを少し待つ。
  await new Promise((r) => setTimeout(r, 80))
  try {
    return await fn()
  } finally {
    for (const win of toRestore) {
      if (!win.isDestroyed()) win.showInactive()
    }
  }
}

// ---------------------------------------------------------------------------
// トレイ
// ---------------------------------------------------------------------------
function updateTrayMenu(): void {
  if (!tray) return
  const s = getSettings()
  const menu = Menu.buildFromTemplate([
    {
      label: captureModeActive ? 'キャプチャーモード中…' : 'キャプチャーモード開始',
      click: () => (captureModeActive ? exitCaptureMode() : enterCaptureMode())
    },
    { label: '設定を開く', click: () => { enterCaptureMode(); showSettingsWindow() } },
    { type: 'separator' },
    { label: `ホットキー: ${s.hotkey}`, enabled: false },
    { label: '保存先を開く', click: () => shell.openPath(s.saveDir) },
    { type: 'separator' },
    { label: '終了', click: () => { app.exit(0) } }
  ])
  tray.setContextMenu(menu)
  tray.setToolTip('ScreenSnap PDF — 範囲選択でPDF化')
}

function createTray(): void {
  tray = new Tray(trayIcon())
  tray.on('click', () => enterCaptureMode())
  updateTrayMenu()
}

// ---------------------------------------------------------------------------
// グローバルホットキー
// 仕様では「待機中に任意のキー」だが、Electron の globalShortcut では
// 任意キーの捕捉ができないため、設定可能な単一ホットキーで代替する（README 参照）。
// ---------------------------------------------------------------------------
function registerHotkey(): void {
  globalShortcut.unregisterAll()
  const { hotkey } = getSettings()
  try {
    globalShortcut.register(hotkey, () => enterCaptureMode())
  } catch {
    // 不正なアクセラレータは無視（設定画面で直してもらう）。
  }
}

// ---------------------------------------------------------------------------
// IPC ハンドラ
// ---------------------------------------------------------------------------
function registerIpc(): void {
  ipcMain.handle(IPC.GET_SETTINGS, () => getSettings())

  ipcMain.handle(IPC.UPDATE_SETTINGS, (_e, patch: Partial<AppSettings>) => {
    const before = getSettings()
    const next = updateSettings(patch)
    if (patch.hotkey && patch.hotkey !== before.hotkey) registerHotkey()
    // 全オーバーレイへ設定変更を通知（枠の比率やモードを即反映）。
    for (const win of overlays.keys()) {
      if (!win.isDestroyed()) win.webContents.send(IPC.SETTINGS_CHANGED, next)
    }
    updateTrayMenu()
    return next
  })

  ipcMain.handle(IPC.CHOOSE_DIR, async () => {
    const cur = getSettings().saveDir
    const res = await dialog.showOpenDialog({
      title: '保存先フォルダを選択',
      defaultPath: cur,
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || res.filePaths.length === 0) return getSettings()
    return updateSettings({ saveDir: res.filePaths[0] })
  })

  ipcMain.handle(IPC.GET_OVERLAY_INIT, (e): OverlayInit => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const displayId = win ? overlays.get(win) : undefined
    const display =
      screen.getAllDisplays().find((d) => d.id === displayId) ??
      screen.getPrimaryDisplay()
    return {
      settings: getSettings(),
      display: {
        width: display.size.width,
        height: display.size.height,
        scaleFactor: display.scaleFactor
      }
    }
  })

  // 左クリックでのキャプチャ → 即 PDF 保存（仕様 2. / 5.）。
  ipcMain.handle(IPC.CAPTURE, async (e, rect: CaptureRect) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    const displayId = win ? overlays.get(win) : undefined
    const result = await withWindowsHidden(() =>
      captureRectToPdf(displayId ?? screen.getPrimaryDisplay().id, rect, getSettings())
    )
    // 結果を設定パネルへ通知（トースト表示用）。
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.webContents.send(IPC.CAPTURE_DONE, result)
    }
    return result
  })

  // 右クリック→確認→終了（仕様 2.）。確認ダイアログは renderer 側で出す。
  ipcMain.handle(IPC.EXIT_CAPTURE, () => {
    exitCaptureMode()
    return true
  })

  ipcMain.handle(IPC.OPEN_SAVE_DIR, () => shell.openPath(getSettings().saveDir))
}

// ---------------------------------------------------------------------------
// アプリ起動
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', () => enterCaptureMode())

  app.whenReady().then(() => {
    // タスクトレイ常駐型なので Dock/タスクバーには出さない（仕様 2. 起動後トレイ常駐）。
    if (process.platform === 'darwin') app.dock?.hide()

    registerIpc()
    createTray()
    registerHotkey()
    // 起動直後は待機（トレイ常駐）。ホットキーでキャプチャーモードに入る。
  })

  // 全ウィンドウを閉じても終了しない（トレイに常駐し続ける）。
  // ハンドラを登録するだけで既定の自動終了を抑止できる。
  app.on('window-all-closed', () => {
    /* 常駐継続：何もしない */
  })

  app.on('will-quit', () => globalShortcut.unregisterAll())
}
