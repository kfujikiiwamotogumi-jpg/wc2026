import { nativeImage, NativeImage } from 'electron'

// トレイ用 16x16 アイコン（青いドキュメント）。
// ファイルパス依存を避けるため base64 を埋め込む（dev/packaged の両方で動く）。
const ICON_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAANUlEQVR42mNgGF5A3q/yPzZcseoOBibJAGyGkGwAuiFkGYBsCNkGwAyhyAAQHjWAVgYMCAAAsLn1plWTgHoAAAAASUVORK5CYII='

export function trayIcon(): NativeImage {
  return nativeImage.createFromDataURL(`data:image/png;base64,${ICON_BASE64}`)
}
