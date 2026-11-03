import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { Eraser, Volume2, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { HIGHLIGHT_CLASS, HIGHLIGHT_COLORS, addHighlight, eraseRange, splitPieces } from '#/lib/highlights'
import type { HighlightColor } from '#/lib/highlights'
import { paragraphLetter } from '#/lib/reading-topics'
import type { Accent } from '#/lib/speech'
import { speakLong } from '#/lib/speech'
import { cn } from '#/lib/utils'
import type { ReadingHighlight } from '#/db/schema'

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** vị trí đoạn trích trong đoạn văn: bỏ qua hoa/thường, nháy cong, khoảng trắng */
function findQuote(paragraph: string, quote: string): [number, number] | null {
  if (!quote.trim()) return null
  const pattern = escapeRe(quote.trim())
    .replace(/\s+/g, '\\s+')
    .replace(/['‘’]/g, "['‘’]")
    .replace(/["“”]/g, '["“”]')
  const m = new RegExp(pattern, 'i').exec(paragraph)
  return m ? [m.index, m.index + m[0].length] : null
}

/** số ký tự từ đầu phần tử tới một điểm trong vùng chọn */
function offsetIn(el: Element, node: Node, offset: number) {
  const r = document.createRange()
  r.selectNodeContents(el)
  r.setEnd(node, offset)
  return r.toString().length
}

type Toolbar =
  | { kind: 'new'; top: number; left: number; ranges: Array<{ p: number; start: number; end: number }> }
  | { kind: 'edit'; top: number; left: number; index: number }

const SWATCH: Record<HighlightColor, string> = {
  yellow: 'bg-yellow-300',
  green: 'bg-green-300',
  pink: 'bg-pink-300',
  blue: 'bg-sky-300',
}

/**
 * Các đoạn văn của bài đọc. Bôi đen chữ → thanh màu hiện phía trên để tô (như máy thi IELTS),
 * bấm vào chỗ đã tô để đổi màu / xoá. `quote` là đoạn đang được chỉ ra (căn cứ câu hỏi, câu chứa từ).
 */
export function ReadingPassage(props: {
  paragraphs: string[]
  /** đánh chữ A, B, C… trước mỗi đoạn (đề IELTS) */
  lettered: boolean
  accent: Accent
  quote: string
  quoteRef: RefObject<HTMLElement | null>
  highlights: ReadingHighlight[]
  onHighlightsChange: (next: ReadingHighlight[]) => void
}) {
  const { highlights } = props
  const rootRef = useRef<HTMLDivElement>(null)
  const [toolbar, setToolbar] = useState<Toolbar | null>(null)

  useEffect(() => {
    if (!toolbar) return
    const close = (e: Event) => !(e.target instanceof Element && e.target.closest('[data-highlight-toolbar]')) && setToolbar(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setToolbar(null)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true)
    }
  }, [toolbar])

  /** vùng chọn trong bài → vị trí ký tự trong từng đoạn nó đi qua */
  const readSelection = () => {
    const sel = window.getSelection()
    const root = rootRef.current
    if (!sel || sel.isCollapsed || !sel.rangeCount || !root) return null
    const range = sel.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return null
    const ranges = [...root.querySelectorAll<HTMLElement>('[data-para]')].flatMap((el) => {
      if (!range.intersectsNode(el)) return []
      const length = el.textContent.length
      const start = el.contains(range.startContainer) ? offsetIn(el, range.startContainer, range.startOffset) : 0
      const end = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : length
      return end > start ? [{ p: Number(el.dataset.para), start, end }] : []
    })
    if (!ranges.length) return null
    const rect = range.getBoundingClientRect()
    return { ranges, top: rect.top, left: rect.left + rect.width / 2 }
  }

  const apply = (color: HighlightColor) => {
    if (!toolbar) return
    if (toolbar.kind === 'new') {
      props.onHighlightsChange(toolbar.ranges.reduce((list, r) => addHighlight(list, { ...r, color }), highlights))
      window.getSelection()?.removeAllRanges()
    } else props.onHighlightsChange(highlights.map((h, i) => (i === toolbar.index ? { ...h, color } : h)))
    setToolbar(null)
  }

  const erase = () => {
    if (!toolbar) return
    if (toolbar.kind === 'new') {
      props.onHighlightsChange(toolbar.ranges.reduce((list, r) => eraseRange(list, r.p, r.start, r.end), highlights))
      window.getSelection()?.removeAllRanges()
    } else props.onHighlightsChange(highlights.filter((_, i) => i !== toolbar.index))
    setToolbar(null)
  }

  let quoteRefSet = false

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-4"
      onMouseUp={(e) => {
        // nhấp đúp là tra từ nhanh
        if (e.detail >= 2) return
        // đợi trình duyệt cập nhật vùng chọn sau khi nhả chuột
        setTimeout(() => {
          const sel = readSelection()
          if (sel) setToolbar({ kind: 'new', ...sel })
        }, 0)
      }}
    >
      {props.paragraphs.map((text, p) => {
        const pieces = splitPieces(text.length, p, highlights, findQuote(text, props.quote))
        return (
          <div key={p} className="group flex gap-2">
            {props.lettered && <span className="w-5 shrink-0 pt-0.5 font-semibold text-muted-foreground select-none">{paragraphLetter(p)}</span>}
            <p data-para={p} className="flex-1 text-[17px] leading-relaxed">
              {pieces.map((piece) => {
                const chunk = text.slice(piece.start, piece.end)
                if (piece.color == null && !piece.marked) return chunk
                // cuộn tới mảnh đầu tiên của đoạn đang chỉ ra
                const first = piece.marked && !quoteRefSet
                if (first) quoteRefSet = true
                const index = piece.highlight
                return (
                  <mark
                    key={piece.start}
                    ref={first ? props.quoteRef : undefined}
                    className={cn(
                      'text-foreground',
                      piece.color ? cn(HIGHLIGHT_CLASS[piece.color], 'cursor-pointer') : 'bg-transparent',
                      piece.marked && 'underline decoration-amber-500 decoration-2 underline-offset-4',
                      piece.marked && !piece.color && 'rounded bg-amber-200/70 dark:bg-amber-500/30',
                    )}
                    onClick={(e) => {
                      if (index == null || !window.getSelection()?.isCollapsed) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      setToolbar({ kind: 'edit', index, top: rect.top, left: rect.left + rect.width / 2 })
                    }}
                  >
                    {chunk}
                  </mark>
                )
              })}
            </p>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100"
              title="Nghe đoạn này"
              onClick={() => speakLong(text, { accent: props.accent })}
            >
              <Volume2 />
            </Button>
          </div>
        )
      })}

      {toolbar && (
        <div
          data-highlight-toolbar
          role="toolbar"
          aria-label="Tô màu"
          className="fixed z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-popover px-2 py-1 shadow-lg animate-in fade-in-0 zoom-in-95"
          style={{ top: Math.max(8, toolbar.top - 44), left: toolbar.left }}
          // giữ vùng chọn khi bấm nút
          onMouseDown={(e) => e.preventDefault()}
        >
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              title={`Tô màu ${c}`}
              aria-label={`Tô màu ${c}`}
              onClick={() => apply(c)}
              className={cn('size-6 rounded-full border border-black/10 transition-transform hover:scale-110', SWATCH[c])}
            />
          ))}
          <span className="mx-0.5 h-5 w-px bg-border" />
          <Button size="icon" variant="ghost" className="size-7" title="Xoá màu" onClick={erase}>
            <Eraser />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" title="Đóng" onClick={() => setToolbar(null)}>
            <X />
          </Button>
        </div>
      )}
    </div>
  )
}
