import { useEffect, useRef, useState } from 'react'
import {
  Bold,
  Check,
  Clock,
  Download,
  FilePlus2,
  FileText,
  FolderOpen,
  HelpCircle,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Printer,
  Sparkles,
  Split,
  Table as TableIcon,
  Trash2,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Textarea } from '#/components/ui/textarea'
import { ListeningCustomPlayer } from '#/components/listening-custom-player'
import { ListeningTableEditor } from '#/components/listening-table-editor'
import {
  ListeningRichEditor,
  DEFAULT_RICH_CONTENT,
} from '#/components/listening-rich-editor'
import {
  type CustomTable,
  type ListeningNoteSession,
  createDefaultSession,
  createNeilGeorgieTemplate,
  exportSessionToMarkdown,
  formatSecondsToTimestamp,
  parseTimestampToSeconds,
} from '#/lib/listening-note-types'
import { cn } from '#/lib/utils'

const STORAGE_KEY = 'shadowing:listening-custom-sessions'

export function ListeningCustomWorkspace() {
  const [sessions, setSessions] = useState<ListeningNoteSession[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved) as ListeningNoteSession[]
        if (parsed.length) return parsed
      }
    } catch {
      /* ignore */
    }
    return [createDefaultSession()]
  })

  const [currentSessionId, setCurrentSessionId] = useState<string>(() => sessions[0]?.id || '')
  const [viewMode, setViewMode] = useState<'rich' | 'table' | 'notes' | 'split'>('rich')
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving'>('saved')
  const [showSessionMenu, setShowSessionMenu] = useState(false)
  const [showHelpDialog, setShowHelpDialog] = useState(false)

  // Audio player state for interactive timestamps
  const [currentAudioTime, setCurrentAudioTime] = useState<number>(0)
  const [seekTarget, setSeekTarget] = useState<number | null>(null)

  const notesTextareaRef = useRef<HTMLTextAreaElement>(null)

  const activeSession = sessions.find((s) => s.id === currentSessionId) || sessions[0]

  // Tự động lưu sessions vào localStorage khi có thay đổi
  useEffect(() => {
    setSaveStatus('saving')
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
        setSaveStatus('saved')
      } catch {
        /* storage full or unavailable */
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [sessions])

  // Cập nhật session hiện tại
  const updateActiveSession = (patch: Partial<ListeningNoteSession>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === activeSession.id ? { ...s, ...patch, updatedAt: Date.now() } : s)),
    )
  }

  // Cập nhật bảng trong session hiện tại
  const updateTable = (updatedTable: CustomTable) => {
    const updatedTables = activeSession.tables.map((t) =>
      t.id === updatedTable.id ? updatedTable : t,
    )
    if (!updatedTables.some((t) => t.id === updatedTable.id)) {
      updatedTables.push(updatedTable)
    }
    updateActiveSession({ tables: updatedTables })
  }

  // Tạo phiên bài nghe mới
  const handleCreateNewSession = () => {
    const newSession: ListeningNoteSession = {
      id: `session-${Date.now()}`,
      title: `Bài nghe ghi chú mới #${sessions.length + 1}`,
      audioSourceType: 'sample',
      audioUrl: '',
      tables: [createNeilGeorgieTemplate()],
      notes: '',
      richHtml: DEFAULT_RICH_CONTENT,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setSessions((prev) => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    setShowSessionMenu(false)
  }

  // Xoá phiên bài nghe
  const handleDeleteSession = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (sessions.length <= 1) {
      alert('Cần giữ ít nhất 1 bài ghi chú.')
      return
    }
    if (!confirm('Bạn có chắc muốn xoá bài ghi chú này?')) return
    const remaining = sessions.filter((s) => s.id !== idToDelete)
    setSessions(remaining)
    if (currentSessionId === idToDelete) {
      setCurrentSessionId(remaining[0].id)
    }
  }

  // Chèn timestamp vào ô nhập ghi chú tự do
  const handleInsertTimestampToNotes = (ts: string) => {
    const textarea = notesTextareaRef.current
    if (!textarea) {
      const updatedNotes = activeSession.notes ? `${activeSession.notes}\n${ts} ` : `${ts} `
      updateActiveSession({ notes: updatedNotes })
      return
    }
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = activeSession.notes || ''
    const before = text.substring(0, start)
    const after = text.substring(end)
    const newText = `${before}${ts} ${after}`
    updateActiveSession({ notes: newText })
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + ts.length + 1, start + ts.length + 1)
    }, 0)
  }

  // Thao tác định dạng Markdown
  const applyMarkdownFormat = (prefix: string, suffix = '') => {
    const textarea = notesTextareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const text = activeSession.notes || ''
    const selected = text.substring(start, end)
    const replacement = `${prefix}${selected || 'văn bản'}${suffix}`
    const newText = text.substring(0, start) + replacement + text.substring(end)
    updateActiveSession({ notes: newText })
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected.length || 'văn bản'.length),
      )
    }, 0)
  }

  // Xuất file Markdown toàn bộ bài
  const handleExportFullMarkdown = () => {
    const md = exportSessionToMarkdown(activeSession)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeSession.title.replace(/\s+/g, '_')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // In / Xuất PDF
  const handlePrint = () => {
    window.print()
  }

  // Khi click vào timestamp trong text
  const handleSeek = (seconds: number) => {
    setSeekTarget(seconds)
    setTimeout(() => setSeekTarget(null), 500)
  }

  const primaryTable = activeSession.tables[0] || createNeilGeorgieTemplate()

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Thanh điều khiển phiên làm việc (Session bar) */}
      <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Tiêu đề phiên */}
          <div className="flex flex-1 items-center gap-2 min-w-64">
            <Input
              value={activeSession.title}
              onChange={(e) => updateActiveSession({ title: e.target.value })}
              className="h-9 font-semibold text-base sm:text-lg border-transparent hover:border-input focus:border-input"
              placeholder="Tên bài luyện nghe..."
            />
            {saveStatus === 'saved' ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                <Check className="size-3" /> Đã lưu
              </span>
            ) : (
              <span className="text-[11px] text-muted-foreground italic shrink-0">
                Đang lưu...
              </span>
            )}
          </div>

          {/* Các nút hành động */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Danh sách phiên đã lưu */}
            <div className="relative">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-medium"
                onClick={() => setShowSessionMenu(!showSessionMenu)}
              >
                <FolderOpen className="size-3.5 mr-1" />
                <span>Bài đã lưu ({sessions.length})</span>
              </Button>

              {showSessionMenu && (
                <div className="absolute right-0 top-full z-40 mt-1 w-80 rounded-xl border bg-popover p-2 shadow-2xl">
                  <div className="flex items-center justify-between px-2 py-1 border-b pb-2 mb-1">
                    <span className="text-xs font-semibold text-muted-foreground uppercase">
                      Danh sách bài ghi chú
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs text-primary"
                      onClick={handleCreateNewSession}
                    >
                      <FilePlus2 className="size-3.5 mr-1" /> Tạo mới
                    </Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto flex flex-col gap-1">
                    {sessions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setCurrentSessionId(s.id)
                          setShowSessionMenu(false)
                        }}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-lg p-2 text-xs cursor-pointer transition-colors',
                          s.id === activeSession.id
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'hover:bg-muted text-popover-foreground',
                        )}
                      >
                        <div className="truncate flex-1">
                          <div className="truncate">{s.title}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">
                            {new Date(s.updatedAt).toLocaleDateString('vi-VN')}
                          </div>
                        </div>
                        {sessions.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => handleDeleteSession(s.id, e)}
                            className="p-1 text-muted-foreground hover:text-destructive rounded"
                            title="Xoá bài này"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Nút tạo bài mới */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-medium"
              onClick={handleCreateNewSession}
            >
              <FilePlus2 className="size-3.5 mr-1" />
              <span className="hidden sm:inline">Bài mới</span>
            </Button>

            {/* In / Xuất PDF */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-medium"
              onClick={handlePrint}
              title="In hoặc lưu dạng PDF"
            >
              <Printer className="size-3.5 mr-1" />
              <span className="hidden sm:inline">In / PDF</span>
            </Button>

            {/* Xuất Markdown */}
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-medium"
              onClick={handleExportFullMarkdown}
              title="Tải toàn bộ bài ghi chú dưới dạng Markdown .md"
            >
              <Download className="size-3.5 mr-1" />
              <span className="hidden sm:inline">Tải .md</span>
            </Button>

            {/* Hướng dẫn phím tắt */}
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground"
              onClick={() => setShowHelpDialog(true)}
              title="Hướng dẫn & Phím tắt"
            >
              <HelpCircle className="size-4" />
            </Button>
          </div>
        </div>

        {/* Chuyển đổi chế độ xem: Rich Editor, Bảng cấu trúc, Ghi chú Markdown, Song song */}
        <div className="flex flex-wrap items-center gap-1.5 border-t pt-2.5">
          <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Chế độ editor:</span>

          <button
            type="button"
            onClick={() => setViewMode('rich')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer',
              viewMode === 'rich'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Sparkles className="size-3.5 text-amber-300" />
            <span>Rich Editor (WYSIWYG & Bảng)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer',
              viewMode === 'table'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <TableIcon className="size-3.5" />
            <span>Bảng dạng lưới (Grid Table như ảnh)</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('notes')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer',
              viewMode === 'notes'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <FileText className="size-3.5" />
            <span>Ghi chú Markdown</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer',
              viewMode === 'split'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-muted text-muted-foreground hover:text-foreground',
            )}
          >
            <Split className="size-3.5" />
            <span>Song song (Rich Editor + Lưới)</span>
          </button>
        </div>
      </div>

      {/* Phần 1: Trình phát Audio / Video liên kết */}
      <section className="print:hidden">
        <ListeningCustomPlayer
          initialSourceType={activeSession.audioSourceType}
          initialUrl={activeSession.audioUrl}
          initialFileName={activeSession.audioFileName}
          seekToTime={seekTarget}
          onTimeUpdate={(t) => setCurrentAudioTime(t)}
          onSourceChange={(type, url, name) => {
            updateActiveSession({
              audioSourceType: type,
              audioUrl: url,
              audioFileName: name,
            })
          }}
          onInsertTimestamp={(ts) => {
            handleInsertTimestampToNotes(ts)
          }}
        />
      </section>

      {/* Phần 2: Editor Bảng và Ghi chú */}
      <section className="flex flex-col gap-5">
        {/* Chế độ Rich Editor chính */}
        {(viewMode === 'rich' || viewMode === 'split') && (
          <div className="w-full">
            <ListeningRichEditor
              initialContent={activeSession.richHtml || DEFAULT_RICH_CONTENT}
              onChange={(html) => updateActiveSession({ richHtml: html })}
              currentAudioTime={currentAudioTime}
              onSeekToTime={handleSeek}
            />
          </div>
        )}

        {/* Chế độ Bảng cấu trúc Grid hoặc trong Split */}
        {(viewMode === 'table' || viewMode === 'split') && (
          <div className="w-full">
            <ListeningTableEditor
              table={primaryTable}
              onChange={(updated) => updateTable(updated)}
              currentAudioTime={currentAudioTime}
              onSeekToTime={handleSeek}
            />
          </div>
        )}

        {/* Chế độ Ghi chú tự do Markdown */}
        {viewMode === 'notes' && (
          <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:p-5 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                <span className="font-semibold text-sm sm:text-base">Ghi chú tự do (Markdown)</span>
              </div>

              {/* Thanh công cụ định dạng Markdown */}
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => applyMarkdownFormat('**', '**')}
                  title="In đậm (Bold)"
                >
                  <Bold className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => applyMarkdownFormat('*', '*')}
                  title="In nghiêng (Italic)"
                >
                  <Italic className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => applyMarkdownFormat('### ')}
                  title="Tiêu đề (Heading)"
                >
                  <Heading2 className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => applyMarkdownFormat('- ')}
                  title="Gạch đầu dòng (List)"
                >
                  <List className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => applyMarkdownFormat('1. ')}
                  title="Danh sách số (Ordered List)"
                >
                  <ListOrdered className="size-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs font-mono text-primary ml-1"
                  onClick={() => {
                    const ts = formatSecondsToTimestamp(currentAudioTime)
                    handleInsertTimestampToNotes(ts)
                  }}
                  title="Chèn mốc thời gian audio hiện tại"
                >
                  <Clock className="size-3 mr-1" />
                  <span>{formatSecondsToTimestamp(currentAudioTime)}</span>
                </Button>
              </div>
            </div>

            <Textarea
              ref={notesTextareaRef}
              value={activeSession.notes}
              onChange={(e) => updateActiveSession({ notes: e.target.value })}
              placeholder="Gõ ghi chú tự do, tóm tắt ý chính, từ mới hoặc chép chính tả tại đây... Mẹo: Gõ [01:23] để tạo mốc thời gian bấm được."
              className="min-h-[220px] resize-y font-mono text-sm leading-relaxed"
            />

            {/* Hiển thị mốc thời gian nhận diện được trong bài ghi chú */}
            {activeSession.notes && (
              <div className="border-t pt-2.5">
                <NotesTimestampList notes={activeSession.notes} onSeek={handleSeek} />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Modal hướng dẫn phím tắt */}
      {showHelpDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-w-md flex-col gap-4 rounded-2xl border bg-background p-5 shadow-2xl">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="size-5 text-primary" /> Hướng dẫn & Phím tắt
            </h3>
            <div className="flex flex-col gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong>1. Dán link hoặc tải file:</strong> Bạn có thể dán link trực tiếp file audio (.mp3), podcast URL, link YouTube hoặc bấm “Chọn file từ máy” để tải audio của riêng bạn.
              </p>
              <p>
                <strong>2. Rich Editor & Bảng:</strong> Soạn thảo văn bản phong phú với in đậm, in nghiêng, gạch chân, tô sáng nhiều màu, tiêu đề, danh sách. Bảng đã được thiết kế sẵn theo đúng mẫu <em>Neil & Georgie (Cities)</em> với màu cam đào pastel và viền sắc nét. Bạn có thể chèn thêm bảng mới, thêm/bớt hàng, cột, gộp ô ngay trong editor.
              </p>
              <p>
                <strong>3. Mốc thời gian bấm được:</strong> Nhấn nút <strong>⏱ Chèn mốc</strong> hoặc gõ định dạng <code>[01:23]</code>. Bất kỳ lúc nào bạn click vào mốc thời gian, audio sẽ tự động tua ngay đến giây đó.
              </p>
              <div className="rounded-xl bg-muted/60 p-3 flex flex-col gap-1.5 font-mono text-[11px] text-foreground">
                <div className="font-semibold text-xs font-sans pb-1 text-muted-foreground">Phím tắt nhanh:</div>
                <div className="flex justify-between">
                  <span>Phát / Tạm dừng audio:</span>
                  <kbd className="rounded bg-background px-1.5 py-0.5 border">Alt + Space</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Tua lùi 5 giây:</span>
                  <kbd className="rounded bg-background px-1.5 py-0.5 border">Alt + ←</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Tua tiến 5 giây:</span>
                  <kbd className="rounded bg-background px-1.5 py-0.5 border">Alt + →</kbd>
                </div>
                <div className="flex justify-between">
                  <span>Chèn mốc thời gian:</span>
                  <kbd className="rounded bg-background px-1.5 py-0.5 border">Alt + M</kbd>
                </div>
              </div>
            </div>
            <Button
              size="sm"
              className="mt-2 w-full"
              onClick={() => setShowHelpDialog(false)}
            >
              Đã hiểu
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Danh sách các mốc thời gian nhận diện được trong bài ghi chú tự do */
function NotesTimestampList({
  notes,
  onSeek,
}: {
  notes: string
  onSeek: (sec: number) => void
}) {
  const matches = notes.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]|\b\d{1,2}:\d{2}\b/g)
  if (!matches || !matches.length) return null

  const unique = Array.from(new Set(matches))

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
        <Clock className="size-3 text-primary" /> Mốc thời gian trong bài:
      </span>
      {unique.map((ts) => {
        const sec = parseTimestampToSeconds(ts)
        if (sec == null) return null
        return (
          <button
            key={ts}
            type="button"
            onClick={() => onSeek(sec)}
            className="rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
            title={`Bấm để tua đến ${ts}`}
          >
            {ts}
          </button>
        )
      })}
    </div>
  )
}
