import { useCallback, useEffect, useState } from 'react'
import { Languages } from 'lucide-react'

import { WordLookupCard } from '#/components/word-lookup-card'
import type { LookupTarget } from '#/components/word-lookup-card'
import { useStoredToggle } from '#/hooks/use-stored-toggle'

/** tắt tra nhanh (mặc định bật) — chỉnh ở Cài đặt */
export const QUICK_LOOKUP_OFF_KEY = 'quick-lookup.off'

/** chỗ đã có cách tra riêng hoặc người dùng đang gõ / bấm: không bật tra nhanh */
const SKIP =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], button, a, [role="dialog"], [data-no-quick-lookup]'

/** chỉ tra từ / cụm tiếng Anh ngắn (1–5 từ); bỏ tiếng Việt, số, đoạn dài */
function lookupText(raw: string) {
  const text = raw.replace(/\s+/g, ' ').replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
  if (!text || text.length > 60 || text.split(' ').length > 5) return null
  return /^[A-Za-z][A-Za-z'’\- ]*$/.test(text) ? text : null
}

/** câu chứa đoạn được chọn, lấy trong khối văn bản gần nhất (để AI tra nghĩa theo ngữ cảnh khi bấm) */
function sentenceAround(range: Range, text: string) {
  const node = range.startContainer
  const el = node instanceof Element ? node : node.parentElement
  const block = el?.closest('p, li, td, th, dd, blockquote, h1, h2, h3, h4, article, section') ?? el
  const all = (block as HTMLElement | null)?.innerText.replace(/\s+/g, ' ').trim() ?? text
  const lower = text.toLowerCase()
  const sentence = all.split(/(?<=[.!?])\s+/).find((s) => s.toLowerCase().includes(lower)) ?? all
  return sentence.slice(0, 600)
}

function targetFromSelection(): LookupTarget | null {
  const sel = window.getSelection()
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null
  const range = sel.getRangeAt(0)
  const start = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
  if (start?.closest(SKIP)) return null
  const text = lookupText(sel.toString())
  if (!text) return null
  const rect = range.getBoundingClientRect()
  return {
    text,
    sentence: sentenceAround(range, text),
    segmentId: null,
    startMs: 0,
    endMs: 0,
    rect: { top: rect.top, bottom: rect.bottom, left: rect.left },
  }
}

/**
 * Tra từ nhanh ở mọi trang (kiểu ddict): nhấp đúp một từ tiếng Anh → mở thẻ tra từ ngay;
 * bôi đen một cụm → hiện nút nhỏ cạnh chỗ chọn, bấm để tra. Thẻ chỉ dùng từ điển + nghĩa AI đã lưu,
 * muốn nghĩa AI theo câu thì bấm nút trong thẻ.
 */
export function QuickLookup() {
  const [off] = useStoredToggle(QUICK_LOOKUP_OFF_KEY)
  const [target, setTarget] = useState<LookupTarget | null>(null)
  const [pending, setPending] = useState<LookupTarget | null>(null)
  const close = useCallback(() => setTarget(null), [])

  useEffect(() => {
    if (off) return
    const onDblClick = () => {
      const t = targetFromSelection()
      if (!t) return
      setPending(null)
      setTarget(t)
    }
    const onMouseUp = (e: MouseEvent) => {
      // nhấp đúp đã mở thẻ ở dblclick
      if (e.detail >= 2) return
      // đợi trình duyệt cập nhật vùng chọn sau khi nhả chuột
      setTimeout(() => setPending(targetFromSelection()), 0)
    }
    // React gắn sự kiện ở document nên stopPropagation trên nút không chặn được listener này → tự bỏ qua nút
    const onMouseDown = (e: Event) =>
      !(e.target instanceof Element && e.target.closest('[data-quick-lookup-button]')) && setPending(null)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPending(null)
    document.addEventListener('dblclick', onDblClick)
    document.addEventListener('mouseup', onMouseUp)
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onMouseDown, true)
    return () => {
      document.removeEventListener('dblclick', onDblClick)
      document.removeEventListener('mouseup', onMouseUp)
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onMouseDown, true)
    }
  }, [off])

  if (off) return null
  return (
    <>
      {pending && !target && (
        <button
          type="button"
          className="fixed z-50 flex items-center gap-1 rounded-full border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-lg hover:bg-accent animate-in fade-in-0 zoom-in-95"
          style={{ top: pending.rect.bottom + 6, left: pending.rect.left }}
          data-quick-lookup-button
          // giữ vùng chọn khi bấm nút
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setTarget(pending)
            setPending(null)
          }}
        >
          <Languages className="size-3.5" />
          Tra “{pending.text.length > 24 ? `${pending.text.slice(0, 22)}…` : pending.text}”
        </button>
      )}
      {target && <WordLookupCard key={`${target.text}|${target.rect.top}`} target={target} onClose={close} autoAi={false} />}
    </>
  )
}
