import type { Orientation } from './paper'

/** キャプチャの 2 モード（仕様 3.） */
export type CaptureMode =
  | 'fixed' // モードB：用紙サイズ固定枠（本命）
  | 'free' // モードA：自由ドラッグ

/** ファイル名の付け方（仕様 5.：連番 / 日時自動が候補。OCR は後回し） */
export type NamingScheme = 'datetime' | 'sequential'

/** 永続化される設定（仕様 4. 設定パネル） */
export interface AppSettings {
  paperId: string
  orientation: Orientation
  mode: CaptureMode
  /** 保存先フォルダ（未設定なら起動時にピクチャ配下を既定にする） */
  saveDir: string
  naming: NamingScheme
  /** 連番方式のときの次の番号 */
  sequentialNext: number
  /** キャプチャーモードに入るグローバルホットキー */
  hotkey: string
  /** サイズ固定モードの枠サイズ（画面論理px・短辺基準で保持） */
  fixedFrameLongPx: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  paperId: 'A4',
  orientation: 'portrait',
  mode: 'fixed',
  saveDir: '',
  naming: 'datetime',
  sequentialNext: 1,
  hotkey: 'CommandOrControl+Shift+S',
  fixedFrameLongPx: 600
}

/** オーバーレイから受け取る、画面論理座標(DIP)での矩形 */
export interface CaptureRect {
  x: number
  y: number
  width: number
  height: number
}

/** キャプチャ実行の結果 */
export interface CaptureResult {
  ok: boolean
  filePath?: string
  error?: string
}

/** オーバーレイ初期化時に渡す情報 */
export interface OverlayInit {
  settings: AppSettings
  /** このオーバーレイが担当するディスプレイの論理サイズ */
  display: { width: number; height: number; scaleFactor: number }
}
