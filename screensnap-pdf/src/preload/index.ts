import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type { AppSettings, CaptureRect, CaptureResult, OverlayInit } from '../shared/types'

// renderer から呼べる安全な API（contextIsolation 前提）。
const api = {
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.GET_SETTINGS),
  updateSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke(IPC.UPDATE_SETTINGS, patch),
  chooseDir: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.CHOOSE_DIR),
  openSaveDir: (): Promise<string> => ipcRenderer.invoke(IPC.OPEN_SAVE_DIR),

  getOverlayInit: (): Promise<OverlayInit> => ipcRenderer.invoke(IPC.GET_OVERLAY_INIT),
  capture: (rect: CaptureRect): Promise<CaptureResult> =>
    ipcRenderer.invoke(IPC.CAPTURE, rect),
  exitCapture: (): Promise<boolean> => ipcRenderer.invoke(IPC.EXIT_CAPTURE),

  // main → renderer の購読。戻り値は解除関数。
  onSettingsChanged: (cb: (s: AppSettings) => void): (() => void) => {
    const h = (_e: unknown, s: AppSettings): void => cb(s)
    ipcRenderer.on(IPC.SETTINGS_CHANGED, h)
    return () => ipcRenderer.removeListener(IPC.SETTINGS_CHANGED, h)
  },
  onCaptureDone: (cb: (r: CaptureResult) => void): (() => void) => {
    const h = (_e: unknown, r: CaptureResult): void => cb(r)
    ipcRenderer.on(IPC.CAPTURE_DONE, h)
    return () => ipcRenderer.removeListener(IPC.CAPTURE_DONE, h)
  }
}

export type ScreenSnapApi = typeof api

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // フォールバック（contextIsolation 無効時）。
  // @ts-ignore - グローバル拡張
  window.api = api
}
