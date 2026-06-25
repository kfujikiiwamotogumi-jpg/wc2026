import { desktopCapturer, nativeImage, screen, NativeImage, Display } from 'electron'
import { promises as fs } from 'fs'
import { join } from 'path'
import { PDFDocument } from 'pdf-lib'
import { AppSettings, CaptureRect, CaptureResult } from '@shared/types'
import { getPaper, paperDimsPt } from '@shared/paper'
import { nextSequential } from './store'

/**
 * 指定ディスプレイの画面全体を「実ピクセル解像度」で取得する。
 * thumbnailSize に scaleFactor を掛けた実寸を渡すことで、
 * 画面解像度どおりの NativeImage を得る（HiDPI 対応）。
 */
async function grabDisplay(display: Display): Promise<NativeImage | null> {
  const realW = Math.round(display.size.width * display.scaleFactor)
  const realH = Math.round(display.size.height * display.scaleFactor)

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: realW, height: realH }
  })

  // display_id で対象ディスプレイを特定する（取れない環境ではインデックスで代替）。
  const matched =
    sources.find((s) => s.display_id === String(display.id)) ?? sources[0]
  if (!matched) return null
  return matched.thumbnail
}

/** YYYYMMDD_HHmmss 形式の文字列 */
function timestamp(): string {
  const d = new Date()
  const p = (n: number, len = 2): string => String(n).padStart(len, '0')
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  )
}

function buildFileName(settings: AppSettings): string {
  if (settings.naming === 'sequential') {
    return `ScreenSnap_${String(nextSequential()).padStart(4, '0')}.pdf`
  }
  // datetime（既定）。同一秒の連写でも衝突しないようミリ秒を付与。
  return `ScreenSnap_${timestamp()}_${String(Date.now() % 1000).padStart(3, '0')}.pdf`
}

/**
 * 1 枚の PNG を、用紙サイズの 1 ページ PDF に変換して保存する（仕様 5.：撮った瞬間に即PDF）。
 * 画像のアスペクト比は用紙比に合わせて選択されている前提だが、
 * 念のため contain 配置で中央に収める。
 */
async function pngToPdf(
  pngBuffer: Buffer,
  settings: AppSettings,
  outPath: string
): Promise<void> {
  const paper = getPaper(settings.paperId)
  const { w: pageW, h: pageH } = paperDimsPt(paper, settings.orientation)

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([pageW, pageH])
  const png = await pdf.embedPng(pngBuffer)

  // ページに収まるよう contain スケール（用紙比と一致していればほぼ全面）。
  const scale = Math.min(pageW / png.width, pageH / png.height)
  const drawW = png.width * scale
  const drawH = png.height * scale
  page.drawImage(png, {
    x: (pageW - drawW) / 2,
    y: (pageH - drawH) / 2,
    width: drawW,
    height: drawH
  })

  const bytes = await pdf.save()
  await fs.writeFile(outPath, bytes)
}

/**
 * オーバーレイから渡された矩形（論理座標 DIP）を、対象ディスプレイの実ピクセルへ
 * 変換してクロップし、PDF として保存する。
 */
export async function captureRectToPdf(
  displayId: number,
  rect: CaptureRect,
  settings: AppSettings
): Promise<CaptureResult> {
  try {
    const display =
      screen.getAllDisplays().find((d) => d.id === displayId) ??
      screen.getPrimaryDisplay()

    const full = await grabDisplay(display)
    if (!full) return { ok: false, error: '画面の取得に失敗しました' }

    const sf = display.scaleFactor
    // DIP → 実ピクセル。画面外にはみ出さないようクランプ。
    const imgSize = full.getSize()
    const cx = Math.max(0, Math.round(rect.x * sf))
    const cy = Math.max(0, Math.round(rect.y * sf))
    const cw = Math.min(imgSize.width - cx, Math.round(rect.width * sf))
    const ch = Math.min(imgSize.height - cy, Math.round(rect.height * sf))

    if (cw <= 0 || ch <= 0) {
      return { ok: false, error: '選択範囲が無効です' }
    }

    const cropped = full.crop({ x: cx, y: cy, width: cw, height: ch })
    const pngBuffer = cropped.toPNG()

    await fs.mkdir(settings.saveDir, { recursive: true })
    const outPath = join(settings.saveDir, buildFileName(settings))
    await pngToPdf(pngBuffer, settings, outPath)

    return { ok: true, filePath: outPath }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/** デバッグ/単体確認用：NativeImage 化できるか軽く検査 */
export function makeImageFromBuffer(buf: Buffer): NativeImage {
  return nativeImage.createFromBuffer(buf)
}
