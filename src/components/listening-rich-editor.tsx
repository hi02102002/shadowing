import { useEffect, useState, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import { Table as TipTapTable } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import Placeholder from '@tiptap/extension-placeholder'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Clock,
  Code,
  Copy,
  Download,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListOrdered,
  Pilcrow,
  Printer,
  Quote,
  Redo2,
  Sparkles,
  Strikethrough,
  Table as TableIcon,
  Trash2,
  Underline as UnderlineIcon,
  Undo2,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { formatSecondsToTimestamp, parseTimestampToSeconds } from '#/lib/listening-note-types'
import { cn } from '#/lib/utils'

interface ListeningRichEditorProps {
  initialContent?: string
  onChange?: (html: string) => void
  currentAudioTime?: number
  onSeekToTime?: (seconds: number) => void
}

export const DEFAULT_RICH_CONTENT = `
<h2>Ghi chú bài nghe: Neil & Georgie (Cities)</h2>
<p>Dán link hoặc tải file audio bên trên để vừa nghe vừa ghi chú và điền bảng.</p>

<table style="border-collapse: collapse; width: 100%; border: 2px solid #000; margin: 14px 0;">
  <thead>
    <tr style="background-color: #fed7aa; color: #000;">
      <th style="border: 2px solid #000; padding: 10px; width: 25%; font-weight: bold;"></th>
      <th style="border: 2px solid #000; padding: 10px; text-align: center; font-weight: bold; width: 37.5%;">Neil</th>
      <th style="border: 2px solid #000; padding: 10px; text-align: center; font-weight: bold; width: 37.5%;">Georgie</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">current city</th>
      <td colspan="2" style="border: 2px solid #000; padding: 10px;"></td>
    </tr>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">pros</th>
      <td colspan="2" style="border: 2px solid #000; padding: 10px;"></td>
    </tr>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">cons</th>
      <td colspan="2" style="border: 2px solid #000; padding: 10px;"></td>
    </tr>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">past cities</th>
      <td style="border: 2px solid #000; padding: 10px;">
        <p><strong>1. Madrid</strong></p>
        <p><strong>2. Prague:</strong></p>
      </td>
      <td style="border: 2px solid #000; padding: 10px;">
        <p><strong>1. Barcelona:</strong></p>
        <p><br></p>
        <p><strong>2. Edinburgh:</strong></p>
      </td>
    </tr>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">dream cities to visit</th>
      <td style="border: 2px solid #000; padding: 10px;">
        <p><strong>city:</strong></p>
        <p><br></p>
        <p><strong>reason:</strong></p>
      </td>
      <td style="border: 2px solid #000; padding: 10px;">
        <p><strong>city:</strong></p>
        <p><br></p>
        <p><strong>reason:</strong></p>
      </td>
    </tr>
  </tbody>
</table>

<h3>Điểm từ vựng & Ghi chú thêm:</h3>
<ul>
  <li><mark style="background-color: #fef08a;">pros and cons</mark>: ưu và nhược điểm</li>
  <li><mark style="background-color: #bbf7d0;">bustling city</mark>: thành phố nhộn nhịp, náo nhiệt</li>
  <li><mark style="background-color: #bae6fd;">dream destination</mark>: điểm đến mơ ước</li>
</ul>
`

const HIGHLIGHT_COLORS = [
  { label: 'Vàng', color: '#fef08a' },
  { label: 'Xanh lá', color: '#bbf7d0' },
  { label: 'Xanh lam', color: '#bae6fd' },
  { label: 'Hồng', color: '#fbcfe8' },
  { label: 'Cam', color: '#fed7aa' },
  { label: 'Tím', color: '#e9d5ff' },
]

export function ListeningRichEditor({
  initialContent = DEFAULT_RICH_CONTENT,
  onChange,
  currentAudioTime = 0,
  onSeekToTime,
}: ListeningRichEditorProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [showBlockMenu, setShowBlockMenu] = useState(false)
  const [showHighlightMenu, setShowHighlightMenu] = useState(false)
  const [showTableMenu, setShowTableMenu] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Gõ nội dung ghi chú, chèn bảng hoặc dán văn bản tại đây...',
      }),
      TipTapTable.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'rich-editor-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML())
    },
  })

  // Lắng nghe sự kiện click vào mốc thời gian trong editor
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target) return
      const text = target.textContent?.trim() || ''
      const match = text.match(/\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?/)
      if (match && target.closest('.ProseMirror')) {
        const sec = parseTimestampToSeconds(match[1])
        if (sec !== null && onSeekToTime) {
          e.preventDefault()
          onSeekToTime(sec)
        }
      }
    }

    window.addEventListener('click', handleDocumentClick)
    return () => window.removeEventListener('click', handleDocumentClick)
  }, [onSeekToTime])

  // Chèn mốc thời gian audio hiện tại vào vị trí con trỏ
  const insertTimestamp = useCallback(() => {
    if (!editor) return
    const ts = formatSecondsToTimestamp(currentAudioTime)
    editor
      .chain()
      .focus()
      .insertContent(
        ` <span class="timestamp-badge" style="background-color: #e0f2fe; color: #0369a1; padding: 2px 7px; border-radius: 6px; font-family: monospace; font-weight: bold; cursor: pointer; text-decoration: none; border: 1px solid #7dd3fc; display: inline-flex; align-items: center; gap: 3px;" title="Bấm để tua audio">⏱ ${ts}</span> `,
      )
      .run()
  }, [editor, currentAudioTime])

  // Chèn bảng mẫu Neil & Georgie
  const insertNeilGeorgieTable = () => {
    if (!editor) return
    const tableHtml = `
<table style="border-collapse: collapse; width: 100%; border: 2px solid #000; margin: 14px 0;">
  <thead>
    <tr style="background-color: #fed7aa; color: #000;">
      <th style="border: 2px solid #000; padding: 10px; width: 25%; font-weight: bold;"></th>
      <th style="border: 2px solid #000; padding: 10px; text-align: center; font-weight: bold; width: 37.5%;">Neil</th>
      <th style="border: 2px solid #000; padding: 10px; text-align: center; font-weight: bold; width: 37.5%;">Georgie</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">current city</th>
      <td colspan="2" style="border: 2px solid #000; padding: 10px;"></td>
    </tr>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">pros</th>
      <td colspan="2" style="border: 2px solid #000; padding: 10px;"></td>
    </tr>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">cons</th>
      <td colspan="2" style="border: 2px solid #000; padding: 10px;"></td>
    </tr>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">past cities</th>
      <td style="border: 2px solid #000; padding: 10px;">
        <p><strong>1. Madrid</strong></p>
        <p><strong>2. Prague:</strong></p>
      </td>
      <td style="border: 2px solid #000; padding: 10px;">
        <p><strong>1. Barcelona:</strong></p>
        <p><br></p>
        <p><strong>2. Edinburgh:</strong></p>
      </td>
    </tr>
    <tr>
      <th style="border: 2px solid #000; padding: 10px; text-align: left; font-weight: bold; background-color: #f8fafc;">dream cities to visit</th>
      <td style="border: 2px solid #000; padding: 10px;">
        <p><strong>city:</strong></p>
        <p><br></p>
        <p><strong>reason:</strong></p>
      </td>
      <td style="border: 2px solid #000; padding: 10px;">
        <p><strong>city:</strong></p>
        <p><br></p>
        <p><strong>reason:</strong></p>
      </td>
    </tr>
  </tbody>
</table>
<p></p>
`
    editor.chain().focus().insertContent(tableHtml).run()
    setShowTableMenu(false)
  }

  // Chèn bảng trống
  const insertBlankTable = (rows = 3, cols = 3) => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run()
    setShowTableMenu(false)
  }

  // Sao chép HTML
  const copyHtml = () => {
    if (!editor) return
    const html = editor.getHTML()
    void navigator.clipboard.writeText(html)
    setCopyFeedback('Đã chép mã HTML (dán trực tiếp vào Word / Google Docs)!')
    setTimeout(() => setCopyFeedback(null), 2500)
  }

  // Tải file HTML
  const downloadHtml = () => {
    if (!editor) return
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Listening Notes</title><style>body{font-family:sans-serif;max-width:850px;margin:2rem auto;padding:1rem;line-height:1.6;}table{border-collapse:collapse;width:100%;border:2px solid #000;}th,td{border:2px solid #000;padding:8px;}</style></head><body>${editor.getHTML()}</body></html>`
    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `listening_note_${Date.now()}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!editor) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Đang tải Shadcn Editor...</div>
  }

  const isTableActive = editor.isActive('table')

  // Xác định định dạng khối hiện tại
  const currentBlockType = editor.isActive('heading', { level: 1 })
    ? 'Tiêu đề 1'
    : editor.isActive('heading', { level: 2 })
      ? 'Tiêu đề 2'
      : editor.isActive('heading', { level: 3 })
        ? 'Tiêu đề 3'
        : editor.isActive('bulletList')
          ? 'Gạch đầu dòng'
          : editor.isActive('orderedList')
            ? 'Danh sách số'
            : editor.isActive('blockquote')
              ? 'Trích dẫn'
              : editor.isActive('codeBlock')
                ? 'Đoạn mã'
                : 'Văn bản thường'

  // Đếm từ và ký tự
  const textContent = editor.getText()
  const wordCount = textContent.trim() ? textContent.trim().split(/\s+/).length : 0
  const charCount = textContent.length

  return (
    <div className="flex flex-col rounded-2xl border bg-card shadow-xs overflow-hidden">
      {/* Thanh công cụ Shadcn Editor Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 border-b bg-muted/40 p-2 sm:px-3">
        <div className="flex flex-wrap items-center gap-1">
          {/* Lịch sử: Undo / Redo */}
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-lg"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
            title="Hoàn tác (Ctrl+Z)"
          >
            <Undo2 className="size-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-lg"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
            title="Làm lại (Ctrl+Y)"
          >
            <Redo2 className="size-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Chọn loại khối (Block Type Dropdown) */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 px-2.5 text-xs font-medium rounded-lg"
              onClick={() => setShowBlockMenu(!showBlockMenu)}
            >
              <span>{currentBlockType}</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>

            {showBlockMenu && (
              <div className="absolute left-0 top-full z-40 mt-1 w-44 rounded-xl border bg-popover p-1 shadow-xl">
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-muted',
                    editor.isActive('paragraph') && 'bg-muted font-semibold',
                  )}
                  onClick={() => {
                    editor.chain().focus().setParagraph().run()
                    setShowBlockMenu(false)
                  }}
                >
                  <Pilcrow className="size-3.5 text-muted-foreground" />
                  <span>Văn bản thường</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-muted font-bold',
                    editor.isActive('heading', { level: 1 }) && 'bg-muted',
                  )}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                    setShowBlockMenu(false)
                  }}
                >
                  <Heading1 className="size-3.5 text-muted-foreground" />
                  <span>Tiêu đề 1 (H1)</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-muted font-semibold',
                    editor.isActive('heading', { level: 2 }) && 'bg-muted',
                  )}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                    setShowBlockMenu(false)
                  }}
                >
                  <Heading2 className="size-3.5 text-muted-foreground" />
                  <span>Tiêu đề 2 (H2)</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-muted font-medium',
                    editor.isActive('heading', { level: 3 }) && 'bg-muted',
                  )}
                  onClick={() => {
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                    setShowBlockMenu(false)
                  }}
                >
                  <Heading3 className="size-3.5 text-muted-foreground" />
                  <span>Tiêu đề 3 (H3)</span>
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-muted',
                    editor.isActive('bulletList') && 'bg-muted font-semibold',
                  )}
                  onClick={() => {
                    editor.chain().focus().toggleBulletList().run()
                    setShowBlockMenu(false)
                  }}
                >
                  <List className="size-3.5 text-muted-foreground" />
                  <span>Gạch đầu dòng</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-muted',
                    editor.isActive('orderedList') && 'bg-muted font-semibold',
                  )}
                  onClick={() => {
                    editor.chain().focus().toggleOrderedList().run()
                    setShowBlockMenu(false)
                  }}
                >
                  <ListOrdered className="size-3.5 text-muted-foreground" />
                  <span>Danh sách số</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-muted',
                    editor.isActive('blockquote') && 'bg-muted font-semibold',
                  )}
                  onClick={() => {
                    editor.chain().focus().toggleBlockquote().run()
                    setShowBlockMenu(false)
                  }}
                >
                  <Quote className="size-3.5 text-muted-foreground" />
                  <span>Trích dẫn</span>
                </button>
                <button
                  type="button"
                  className={cn(
                    'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-left hover:bg-muted',
                    editor.isActive('codeBlock') && 'bg-muted font-semibold',
                  )}
                  onClick={() => {
                    editor.chain().focus().toggleCodeBlock().run()
                    setShowBlockMenu(false)
                  }}
                >
                  <Code className="size-3.5 text-muted-foreground" />
                  <span>Đoạn mã</span>
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Định dạng chữ: Bold, Italic, Underline, Strike, Code */}
          <Button
            size="icon"
            variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
            className="size-8 rounded-lg"
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="In đậm (Ctrl+B)"
          >
            <Bold className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
            className="size-8 rounded-lg"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="In nghiêng (Ctrl+I)"
          >
            <Italic className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
            className="size-8 rounded-lg"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Gạch chân (Ctrl+U)"
          >
            <UnderlineIcon className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
            className="size-8 rounded-lg"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Gạch ngang"
          >
            <Strikethrough className="size-4" />
          </Button>

          {/* Tô màu Highlight (vàng, xanh lá, xanh lam, hồng...) */}
          <div className="relative">
            <Button
              size="icon"
              variant={editor.isActive('highlight') ? 'secondary' : 'ghost'}
              className="size-8 rounded-lg text-amber-500"
              onClick={() => setShowHighlightMenu(!showHighlightMenu)}
              title="Tô màu chữ (Highlight)"
            >
              <Highlighter className="size-4" />
            </Button>
            {showHighlightMenu && (
              <div className="absolute left-0 top-full z-40 mt-1 flex items-center gap-1.5 rounded-xl border bg-popover p-2 shadow-xl">
                {HIGHLIGHT_COLORS.map((c) => (
                  <button
                    key={c.color}
                    type="button"
                    className="size-6 rounded-full border border-black/20 hover:scale-115 transition-transform"
                    style={{ backgroundColor: c.color }}
                    onClick={() => {
                      editor.chain().focus().toggleHighlight({ color: c.color }).run()
                      setShowHighlightMenu(false)
                    }}
                    title={c.label}
                  />
                ))}
                <button
                  type="button"
                  className="size-6 rounded-full bg-muted border border-border flex items-center justify-center text-[10px] text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                  onClick={() => {
                    editor.chain().focus().unsetHighlight().run()
                    setShowHighlightMenu(false)
                  }}
                  title="Xoá màu tô"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Căn lề */}
          <Button
            size="icon"
            variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
            className="size-8 rounded-lg"
            onClick={() => editor.chain().focus().setTextAlign('left').run()}
            title="Căn trái"
          >
            <AlignLeft className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
            className="size-8 rounded-lg"
            onClick={() => editor.chain().focus().setTextAlign('center').run()}
            title="Căn giữa"
          >
            <AlignCenter className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
            className="size-8 rounded-lg"
            onClick={() => editor.chain().focus().setTextAlign('right').run()}
            title="Căn phải"
          >
            <AlignRight className="size-4" />
          </Button>
          <Button
            size="icon"
            variant={editor.isActive({ textAlign: 'justify' }) ? 'secondary' : 'ghost'}
            className="size-8 rounded-lg"
            onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            title="Căn đều hai bên"
          >
            <AlignJustify className="size-4" />
          </Button>

          <div className="h-4 w-px bg-border mx-1" />

          {/* Công cụ chèn Bảng */}
          <div className="relative">
            <Button
              size="sm"
              variant={isTableActive ? 'secondary' : 'outline'}
              className="h-8 gap-1 px-2.5 text-xs font-semibold rounded-lg"
              onClick={() => setShowTableMenu(!showTableMenu)}
            >
              <TableIcon className="size-3.5 text-primary" />
              <span>Chèn bảng</span>
              <ChevronDown className="size-3 text-muted-foreground" />
            </Button>

            {showTableMenu && (
              <div className="absolute left-0 top-full z-40 mt-1 w-68 rounded-xl border bg-popover p-1.5 shadow-2xl">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase">
                  Mẫu bảng
                </div>
                <button
                  type="button"
                  className="w-full rounded-lg px-2.5 py-2 text-left text-xs text-popover-foreground hover:bg-muted font-medium flex items-center gap-2"
                  onClick={insertNeilGeorgieTable}
                >
                  <Sparkles className="size-4 text-amber-500 shrink-0" />
                  <div>
                    <div className="font-semibold text-foreground">Bảng Neil & Georgie (như ảnh)</div>
                    <div className="text-[10px] text-muted-foreground">Màu cam đào, hàng gộp và danh sách</div>
                  </div>
                </button>
                <div className="h-px bg-border my-1" />
                <button
                  type="button"
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground hover:bg-muted font-medium"
                  onClick={() => insertBlankTable(3, 3)}
                >
                  Bảng trống (3 cột x 3 hàng)
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground hover:bg-muted font-medium"
                  onClick={() => insertBlankTable(5, 2)}
                >
                  Bảng so sánh 2 cột (5 hàng)
                </button>
                <button
                  type="button"
                  className="w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-popover-foreground hover:bg-muted font-medium"
                  onClick={() => insertBlankTable(4, 4)}
                >
                  Bảng 4 cột x 4 hàng
                </button>
              </div>
            )}
          </div>

          {/* Nút chèn mốc thời gian audio hiện tại */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-2.5 text-xs text-primary border-primary/40 hover:bg-primary/10 font-mono font-semibold rounded-lg"
            onClick={insertTimestamp}
            title="Chèn mốc thời gian audio hiện tại vào con trỏ (Alt+M)"
          >
            <Clock className="size-3.5" />
            <span>⏱ {formatSecondsToTimestamp(currentAudioTime)}</span>
          </Button>
        </div>

        {/* Nhóm thao tác Sao chép & In ấn */}
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs rounded-lg"
            onClick={copyHtml}
            title="Sao chép HTML để dán vào Word hoặc Google Docs"
          >
            <Copy className="size-3.5 mr-1" />
            <span className="hidden sm:inline">Chép (Word/Docs)</span>
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-lg"
            onClick={downloadHtml}
            title="Tải file HTML"
          >
            <Download className="size-4" />
          </Button>

          <Button
            size="icon"
            variant="ghost"
            className="size-8 rounded-lg"
            onClick={() => window.print()}
            title="In / Xuất PDF"
          >
            <Printer className="size-4" />
          </Button>
        </div>
      </div>

      {/* Thanh công cụ phụ khi con trỏ đang ở bên trong Bảng (Table Controls) */}
      {isTableActive && (
        <div className="flex flex-wrap items-center gap-1 border-b bg-muted/60 px-3 py-1.5 text-xs animate-fade-in">
          <span className="font-semibold text-foreground mr-1 flex items-center gap-1 text-[11px]">
            <TableIcon className="size-3 text-primary" /> Bảng:
          </span>

          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] rounded"
            onClick={() => editor.chain().focus().addRowBefore().run()}
          >
            + Hàng trên
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] rounded"
            onClick={() => editor.chain().focus().addRowAfter().run()}
          >
            + Hàng dưới
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 rounded"
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            Xoá hàng
          </Button>

          <div className="h-3.5 w-px bg-border mx-1" />

          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] rounded"
            onClick={() => editor.chain().focus().addColumnBefore().run()}
          >
            + Cột trước
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] rounded"
            onClick={() => editor.chain().focus().addColumnAfter().run()}
          >
            + Cột sau
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 rounded"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            Xoá cột
          </Button>

          <div className="h-3.5 w-px bg-border mx-1" />

          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] rounded"
            onClick={() => editor.chain().focus().mergeCells().run()}
          >
            Gộp ô
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] rounded"
            onClick={() => editor.chain().focus().splitCell().run()}
          >
            Tách ô
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] rounded"
            onClick={() => editor.chain().focus().toggleHeaderRow().run()}
          >
            Bật/Tắt Header
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-1.5 text-[11px] text-destructive hover:bg-destructive/10 rounded ml-auto"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 className="size-3 mr-0.5" /> Xoá bảng
          </Button>
        </div>
      )}

      {/* Thông báo sao chép */}
      {copyFeedback && (
        <div className="bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Vùng soạn thảo Rich Editor ProseMirror */}
      <div className="min-h-[420px] bg-background p-4 sm:p-6 focus-within:outline-none">
        <EditorContent
          editor={editor}
          className="prose prose-sm sm:prose dark:prose-invert max-w-none focus:outline-none"
        />
      </div>

      {/* Thanh trạng thái dưới chân Shadcn Editor (Status Bar) */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>{wordCount} từ</span>
          <span>•</span>
          <span>{charCount} ký tự</span>
          <span>•</span>
          <span className="hidden sm:inline">
            💡 Bấm vào mốc <code>⏱ [01:23]</code> trong bài để tua ngay audio.
          </span>
        </div>
        <div className="font-mono text-[10px]">
          Phím tắt: <strong>Alt+Space</strong> (phát/dừng), <strong>Alt+M</strong> (chèn mốc)
        </div>
      </div>
    </div>
  )
}
