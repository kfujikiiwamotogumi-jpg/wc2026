import { app } from 'electron'
import { join } from 'path'
import Store from 'electron-store'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

// 設定の永続化（保存先フォルダの記憶など。仕様 4.）。
// electron-store は userData 配下に JSON で保存する。完全オフラインで完結する。
const store = new Store<AppSettings>({
  name: 'settings',
  defaults: DEFAULT_SETTINGS
})

export function getSettings(): AppSettings {
  const s = store.store
  // 保存先が未設定なら、Pictures/ScreenSnap PDF を既定にする。
  if (!s.saveDir) {
    s.saveDir = join(app.getPath('pictures'), 'ScreenSnap PDF')
    store.set('saveDir', s.saveDir)
  }
  return s
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  store.set(patch)
  return getSettings()
}

export function nextSequential(): number {
  const n = store.get('sequentialNext', 1)
  store.set('sequentialNext', n + 1)
  return n
}
