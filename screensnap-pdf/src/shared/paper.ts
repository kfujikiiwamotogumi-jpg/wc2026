// 用紙サイズ定義。
// ピクセルではなく「用紙基準」で比率を扱う（仕様 4. 設定パネル）。
// PDF のページ寸法は pt（1pt = 1/72 inch）で表現する。1mm = 2.834645669 pt。

export type Orientation = 'portrait' | 'landscape'

export interface PaperSize {
  /** 内部キー */
  id: string
  /** 表示名 */
  label: string
  /** 縦向き時の短辺(mm) */
  widthMm: number
  /** 縦向き時の長辺(mm) */
  heightMm: number
}

const MM_TO_PT = 2.834645669291339

/** 仕様で挙がっている A4 / A3 / B5 を中心に、よく使う用紙を用意する */
export const PAPER_SIZES: PaperSize[] = [
  { id: 'A3', label: 'A3 (297 × 420 mm)', widthMm: 297, heightMm: 420 },
  { id: 'A4', label: 'A4 (210 × 297 mm)', widthMm: 210, heightMm: 297 },
  { id: 'A5', label: 'A5 (148 × 210 mm)', widthMm: 148, heightMm: 210 },
  { id: 'B4', label: 'B4 (257 × 364 mm)', widthMm: 257, heightMm: 364 },
  { id: 'B5', label: 'B5 (182 × 257 mm)', widthMm: 182, heightMm: 257 },
  { id: 'Letter', label: 'Letter (216 × 279 mm)', widthMm: 215.9, heightMm: 279.4 }
]

export function getPaper(id: string): PaperSize {
  return PAPER_SIZES.find((p) => p.id === id) ?? PAPER_SIZES[1] // 既定 A4
}

/** 向きを考慮した実寸(mm)を返す */
export function paperDimsMm(paper: PaperSize, orientation: Orientation): { w: number; h: number } {
  return orientation === 'portrait'
    ? { w: paper.widthMm, h: paper.heightMm }
    : { w: paper.heightMm, h: paper.widthMm }
}

/** 向きを考慮した PDF ページ寸法(pt)を返す */
export function paperDimsPt(paper: PaperSize, orientation: Orientation): { w: number; h: number } {
  const mm = paperDimsMm(paper, orientation)
  return { w: mm.w * MM_TO_PT, h: mm.h * MM_TO_PT }
}

/** 枠の縦横比（幅 / 高さ）。サイズ固定モードの枠形状に使う */
export function paperAspect(paper: PaperSize, orientation: Orientation): number {
  const mm = paperDimsMm(paper, orientation)
  return mm.w / mm.h
}
