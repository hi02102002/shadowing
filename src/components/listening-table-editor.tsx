import { useState } from 'react'
import {
  Clock,
  Columns,
  Copy,
  Download,
  MoveDown,
  MoveUp,
  Palette,
  Plus,
  Sparkles,
  Split,
  Table as TableIcon,
  Trash2,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import {
  type CustomTable,
  HEADER_COLOR_OPTIONS,
  type TableRow,
  createBlankTable,
  createDictationVocabTemplate,
  createIeltsNoteTemplate,
  createNeilGeorgieTemplate,
  formatSecondsToTimestamp,
  parseTimestampToSeconds,
  tableToHtml,
  tableToMarkdown,
} from '#/lib/listening-note-types'
import { cn } from '#/lib/utils'

interface ListeningTableEditorProps {
  table: CustomTable
  onChange: (updatedTable: CustomTable) => void
  currentAudioTime?: number
  onSeekToTime?: (seconds: number) => void
}

export function ListeningTableEditor({
  table,
  onChange,
  currentAudioTime = 0,
  onSeekToTime,
}: ListeningTableEditorProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [activeCellCoord, setActiveCellCoord] = useState<{
    rowId: string
    colId: string
  } | null>(null)

  // Cập nhật tiêu đề bảng
  const updateTitle = (title: string) => {
    onChange({ ...table, title })
  }

  // Cập nhật màu tiêu đề
  const updateHeaderColor = (headerColor: string) => {
    onChange({ ...table, headerColor })
  }

  // Thêm một cột mới
  const addColumn = () => {
    const newColId = `col-${Date.now()}`
    const newColName = `Cột ${table.columns.length + 1}`
    const updatedColumns = [...table.columns, { id: newColId, name: newColName }]
    const updatedRows = table.rows.map((row) => ({
      ...row,
      cells: { ...row.cells, [newColId]: '' },
    }))
    onChange({ ...table, columns: updatedColumns, rows: updatedRows })
  }

  // Xoá một cột
  const removeColumn = (colId: string) => {
    if (table.columns.length <= 1) return
    const updatedColumns = table.columns.filter((c) => c.id !== colId)
    const updatedRows = table.rows.map((row) => {
      const nextCells = { ...row.cells }
      delete nextCells[colId]
      return { ...row, cells: nextCells }
    })
    onChange({ ...table, columns: updatedColumns, rows: updatedRows })
  }

  // Đổi tên cột
  const renameColumn = (colId: string, newName: string) => {
    const updatedColumns = table.columns.map((c) =>
      c.id === colId ? { ...c, name: newName } : c,
    )
    onChange({ ...table, columns: updatedColumns })
  }

  // Thêm một hàng mới
  const addRow = (index?: number) => {
    const newRowId = `row-${Date.now()}`
    const newRow: TableRow = {
      id: newRowId,
      label: `Mục mới`,
      isMerged: false,
      cells: Object.fromEntries(table.columns.map((c) => [c.id, ''])),
    }
    const updatedRows = [...table.rows]
    if (index !== undefined) {
      updatedRows.splice(index + 1, 0, newRow)
    } else {
      updatedRows.push(newRow)
    }
    onChange({ ...table, rows: updatedRows })
  }

  // Xoá một hàng
  const removeRow = (rowId: string) => {
    if (table.rows.length <= 1) return
    onChange({ ...table, rows: table.rows.filter((r) => r.id !== rowId) })
  }

  // Di chuyển hàng lên hoặc xuống
  const moveRow = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= table.rows.length) return
    const updatedRows = [...table.rows]
    const temp = updatedRows[index]
    updatedRows[index] = updatedRows[targetIndex]
    updatedRows[targetIndex] = temp
    onChange({ ...table, rows: updatedRows })
  }

  // Bật/tắt gộp ô ngang cho 1 hàng
  const toggleRowMerge = (rowId: string) => {
    const updatedRows = table.rows.map((r) =>
      r.id === rowId ? { ...r, isMerged: !r.isMerged } : r,
    )
    onChange({ ...table, rows: updatedRows })
  }

  // Cập nhật nội dung ô
  const updateCell = (rowId: string, colId: string, value: string) => {
    const updatedRows = table.rows.map((r) => {
      if (r.id !== rowId) return r
      return {
        ...r,
        cells: { ...r.cells, [colId]: value },
      }
    })
    onChange({ ...table, rows: updatedRows })
  }

  // Cập nhật nhãn hàng (cột tiêu chí bên trái)
  const updateRowLabel = (rowId: string, label: string) => {
    const updatedRows = table.rows.map((r) =>
      r.id === rowId ? { ...r, label } : r,
    )
    onChange({ ...table, rows: updatedRows })
  }

  // Chèn mốc thời gian vào ô đang chọn
  const insertTimestampToActiveCell = () => {
    if (!activeCellCoord) return
    const ts = formatSecondsToTimestamp(currentAudioTime)
    const currentRow = table.rows.find((r) => r.id === activeCellCoord.rowId)
    if (!currentRow) return
    const oldVal = currentRow.cells[activeCellCoord.colId] || ''
    const newVal = oldVal ? `${oldVal} ${ts}` : ts
    updateCell(activeCellCoord.rowId, activeCellCoord.colId, newVal)
  }

  // Xử lý sao chép Markdown
  const copyAsMarkdown = () => {
    const md = tableToMarkdown(table)
    void navigator.clipboard.writeText(md)
    setCopyFeedback('Đã chép Markdown!')
    setTimeout(() => setCopyFeedback(null), 2000)
  }

  // Xử lý sao chép HTML (dán vào Word / Docs)
  const copyAsHtml = () => {
    const html = tableToHtml(table)
    void navigator.clipboard.writeText(html)
    setCopyFeedback('Đã chép bảng HTML (Word/Docs)!')
    setTimeout(() => setCopyFeedback(null), 2000)
  }

  // Tải file Markdown
  const downloadMarkdown = () => {
    const md = tableToMarkdown(table)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${table.title.replace(/\s+/g, '_')}.md`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border bg-card p-3 sm:p-5 shadow-xs">
      {/* Thanh công cụ tiêu đề & template */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b pb-3.5">
        <div className="flex flex-1 items-center gap-2">
          <TableIcon className="size-5 text-primary shrink-0" />
          <Input
            value={table.title}
            onChange={(e) => updateTitle(e.target.value)}
            className="h-8 max-w-sm font-semibold text-base sm:text-lg border-transparent hover:border-input focus:border-input"
            placeholder="Tên bảng ghi chú..."
          />
        </div>

        {/* Nút mẫu và thao tác */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Menu chọn mẫu bảng */}
          <div className="relative group">
            <Button size="sm" variant="outline" className="h-8 text-xs font-medium">
              <Sparkles className="size-3.5 mr-1 text-amber-500" />
              <span>Đổi mẫu bảng</span>
            </Button>
            <div className="absolute right-0 top-full z-30 mt-1 hidden w-72 rounded-xl border bg-popover p-1.5 shadow-xl group-hover:block">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase">
                Mẫu có sẵn
              </div>
              <button
                type="button"
                className="w-full rounded-md px-2 py-2 text-left text-xs text-popover-foreground hover:bg-muted font-medium flex flex-col gap-0.5"
                onClick={() => onChange(createNeilGeorgieTemplate())}
              >
                <span>⭐ Neil & Georgie (Cities - như ảnh)</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Bảng so sánh 2 người với hàng gộp và danh sách
                </span>
              </button>
              <button
                type="button"
                className="w-full rounded-md px-2 py-2 text-left text-xs text-popover-foreground hover:bg-muted font-medium flex flex-col gap-0.5"
                onClick={() => onChange(createIeltsNoteTemplate())}
              >
                <span>IELTS Listening Note Completion</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  3 cột: Từ khoá, Đáp án, Mốc thời gian
                </span>
              </button>
              <button
                type="button"
                className="w-full rounded-md px-2 py-2 text-left text-xs text-popover-foreground hover:bg-muted font-medium flex flex-col gap-0.5"
                onClick={() => onChange(createDictationVocabTemplate())}
              >
                <span>Chép chính tả & Từ vựng mới</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Ghi lại câu nghe được, từ vựng và nghĩa
                </span>
              </button>
              <button
                type="button"
                className="w-full rounded-md px-2 py-2 text-left text-xs text-popover-foreground hover:bg-muted font-medium flex flex-col gap-0.5"
                onClick={() => onChange(createBlankTable(2, 4))}
              >
                <span>Bảng trống (2 cột x 4 hàng)</span>
                <span className="text-[10px] text-muted-foreground font-normal">
                  Bắt đầu tự thiết kế bảng từ đầu
                </span>
              </button>
            </div>
          </div>

          {/* Chọn màu tiêu đề */}
          <div className="relative">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setShowColorPicker(!showColorPicker)}
              title="Đổi màu nền thanh tiêu đề"
            >
              <Palette className="size-3.5 mr-1" />
              <span>Màu tiêu đề</span>
              <span
                className="ml-1 size-3 rounded-full border border-black/20"
                style={{ backgroundColor: table.headerColor }}
              />
            </Button>
            {showColorPicker && (
              <div className="absolute right-0 top-full z-30 mt-1 flex flex-col gap-1 rounded-xl border bg-popover p-2 shadow-xl">
                {HEADER_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-popover-foreground hover:bg-muted"
                    onClick={() => {
                      updateHeaderColor(opt.value)
                      setShowColorPicker(false)
                    }}
                  >
                    <span
                      className="size-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: opt.value }}
                    />
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Thêm hàng / cột */}
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => addRow()}>
            <Plus className="size-3.5 mr-1" /> Thêm hàng
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={addColumn}>
            <Columns className="size-3.5 mr-1" /> Thêm cột
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs text-primary"
            disabled={!activeCellCoord}
            onClick={insertTimestampToActiveCell}
            title="Chèn mốc thời gian audio hiện tại vào ô đang chọn"
          >
            <Clock className="size-3.5 mr-1" /> Mốc vào ô
          </Button>

          {/* Xuất / Sao chép */}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={copyAsHtml}
            title="Sao chép bảng HTML để dán vào Word, Google Docs hoặc Notion"
          >
            <Copy className="size-3.5 mr-1" />
            <span>Chép HTML (Word/Docs)</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={copyAsMarkdown}
            title="Sao chép dưới dạng Markdown"
          >
            <Copy className="size-3.5 mr-1" />
            <span>Markdown</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={downloadMarkdown}
            title="Tải file .md"
          >
            <Download className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Thông báo sao chép */}
      {copyFeedback && (
        <div className="rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary animate-fade-in">
          ✓ {copyFeedback}
        </div>
      )}

      {/* Vùng bảng chính - Thiết kế chuẩn theo ảnh mẫu */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Bảng ghi chú luyện nghe"
        className="w-full overflow-x-auto rounded-xl border-2 border-neutral-800 dark:border-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
      >
        <table className="w-full border-collapse text-left font-sans text-sm">
          {/* Header Row */}
          <thead>
            <tr
              style={{
                backgroundColor: table.headerColor || '#fed7aa',
              }}
              className="border-b-2 border-neutral-800 dark:border-neutral-400 text-neutral-900"
            >
              {/* Cột 0: Ô tiêu chí (Trống hoặc nhãn) */}
              <th
                scope="col"
                className="w-1/4 border-r-2 border-neutral-800 dark:border-neutral-400 p-2 sm:p-3 font-bold"
              >
                <input
                  value={table.labelHeader}
                  onChange={(e) => onChange({ ...table, labelHeader: e.target.value })}
                  placeholder="(Tiêu chí)"
                  className="w-full bg-transparent font-bold placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                />
              </th>

              {/* Các cột dữ liệu (vd: Neil, Georgie) */}
              {table.columns.map((col, colIdx) => (
                <th
                  key={col.id}
                  scope="col"
                  className={cn(
                    'p-2 sm:p-3 text-center font-bold text-neutral-950',
                    colIdx < table.columns.length - 1 &&
                      'border-r-2 border-neutral-800 dark:border-neutral-400',
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <input
                      value={col.name}
                      onChange={(e) => renameColumn(col.id, e.target.value)}
                      className="w-full text-center font-bold bg-transparent text-base focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
                    />
                    {table.columns.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeColumn(col.id)}
                        className="text-neutral-600 hover:text-red-600 opacity-60 hover:opacity-100 p-1 rounded"
                        title="Xoá cột này"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Body Rows */}
          <tbody>
            {table.rows.map((row, rowIdx) => {
              const isLastRow = rowIdx === table.rows.length - 1
              return (
                <tr
                  key={row.id}
                  className={cn(
                    'group/row transition-colors hover:bg-neutral-500/5',
                    !isLastRow && 'border-b-2 border-neutral-800 dark:border-neutral-400',
                  )}
                >
                  {/* Nhãn hàng bên trái (vd: current city, pros, cons, past cities...) */}
                  <th
                    scope="row"
                    className="w-1/4 border-r-2 border-neutral-800 dark:border-neutral-400 p-2 sm:p-3 align-top font-bold text-foreground"
                  >
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <textarea
                          rows={1}
                          value={row.label}
                          onChange={(e) => updateRowLabel(row.id, e.target.value)}
                          placeholder="Tên mục..."
                          className="w-full resize-none bg-transparent font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 leading-snug"
                          style={{ minHeight: '28px' }}
                        />
                      </div>

                      {/* Công cụ thao tác trên từng hàng */}
                      <div className="flex items-center gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity pt-1 border-t border-dashed border-border text-xs">
                        <button
                          type="button"
                          onClick={() => toggleRowMerge(row.id)}
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[11px] font-medium border flex items-center gap-0.5',
                            row.isMerged
                              ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-muted text-muted-foreground hover:text-foreground',
                          )}
                          title={
                            row.isMerged
                              ? 'Đang gộp ô ngang toàn hàng (bấm để tách riêng từng cột)'
                              : 'Gộp ô ngang toàn hàng như dòng "current city", "pros", "cons"'
                          }
                        >
                          <Split className="size-3" />
                          <span>{row.isMerged ? 'Đã gộp' : 'Gộp'}</span>
                        </button>

                        <button
                          type="button"
                          disabled={rowIdx === 0}
                          onClick={() => moveRow(rowIdx, 'up')}
                          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          title="Lên trên"
                        >
                          <MoveUp className="size-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isLastRow}
                          onClick={() => moveRow(rowIdx, 'down')}
                          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                          title="Xuống dưới"
                        >
                          <MoveDown className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => addRow(rowIdx)}
                          className="p-1 text-muted-foreground hover:text-foreground"
                          title="Chèn hàng bên dưới"
                        >
                          <Plus className="size-3" />
                        </button>
                        {table.rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="p-1 text-muted-foreground hover:text-destructive ml-auto"
                            title="Xoá hàng này"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>

                  {/* Nội dung ô */}
                  {row.isMerged ? (
                    /* Hàng gộp ô ngang qua tất cả cột dữ liệu */
                    <td
                      colSpan={table.columns.length}
                      className="p-2 sm:p-3 align-top relative group/cell"
                    >
                      <div className="relative min-h-[50px]">
                        <textarea
                          value={row.cells[table.columns[0]?.id ?? ''] ?? ''}
                          onFocus={() =>
                            setActiveCellCoord({
                              rowId: row.id,
                              colId: table.columns[0]?.id ?? '',
                            })
                          }
                          onChange={(e) =>
                            updateCell(
                              row.id,
                              table.columns[0]?.id ?? '',
                              e.target.value,
                            )
                          }
                          placeholder="Nhập nội dung ghi chú chung cho hàng này..."
                          className="w-full min-h-[50px] resize-y bg-transparent p-1 leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                        />
                        {/* Nút chèn mốc thời gian vào ô */}
                        <div className="absolute right-1 bottom-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => {
                              const ts = formatSecondsToTimestamp(currentAudioTime)
                              const old = row.cells[table.columns[0]?.id ?? ''] || ''
                              updateCell(
                                row.id,
                                table.columns[0]?.id ?? '',
                                old ? `${old} ${ts}` : ts,
                              )
                            }}
                            className="flex items-center gap-1 rounded bg-muted/90 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-primary shadow-xs"
                            title="Chèn mốc thời gian audio vào ô này"
                          >
                            <Clock className="size-2.5" />
                            <span>{formatSecondsToTimestamp(currentAudioTime)}</span>
                          </button>
                        </div>
                      </div>
                      <CellTimestampPills
                        text={row.cells[table.columns[0]?.id ?? ''] ?? ''}
                        onSeek={onSeekToTime}
                      />
                    </td>
                  ) : (
                    /* Từng cột riêng biệt */
                    table.columns.map((col, colIdx) => (
                      <td
                        key={col.id}
                        className={cn(
                          'p-2 sm:p-3 align-top relative group/cell',
                          colIdx < table.columns.length - 1 &&
                            'border-r-2 border-neutral-800 dark:border-neutral-400',
                        )}
                      >
                        <div className="relative min-h-[60px]">
                          <textarea
                            value={row.cells[col.id] ?? ''}
                            onFocus={() =>
                              setActiveCellCoord({ rowId: row.id, colId: col.id })
                            }
                            onChange={(e) => updateCell(row.id, col.id, e.target.value)}
                            placeholder={`Ghi chú cho ${col.name}...`}
                            className="w-full min-h-[60px] resize-y bg-transparent p-1 leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary rounded"
                          />
                          {/* Nút chèn mốc thời gian vào ô */}
                          <div className="absolute right-1 bottom-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                const ts = formatSecondsToTimestamp(currentAudioTime)
                                const old = row.cells[col.id] || ''
                                updateCell(row.id, col.id, old ? `${old} ${ts}` : ts)
                              }}
                              className="flex items-center gap-1 rounded bg-muted/90 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-primary shadow-xs"
                              title="Chèn mốc thời gian audio vào ô này"
                            >
                              <Clock className="size-2.5" />
                              <span>{formatSecondsToTimestamp(currentAudioTime)}</span>
                            </button>
                          </div>
                        </div>
                        <CellTimestampPills
                          text={row.cells[col.id] ?? ''}
                          onSeek={onSeekToTime}
                        />
                      </td>
                    ))
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Chú thích & Mẹo thao tác */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-1">
        <div className="flex items-center gap-2">
          <span>💡 <strong>Mẹo:</strong> Rê chuột vào nhãn hàng bên trái để hiện nút <strong>Gộp</strong> hoặc <strong>Di chuyển hàng</strong>.</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs text-primary"
            onClick={() => addRow()}
          >
            <Plus className="size-3 mr-1" /> Thêm hàng mới
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Hiển thị danh sách các mốc thời gian bấm được bên dưới ô nếu có */
function CellTimestampPills({
  text,
  onSeek,
}: {
  text: string
  onSeek?: (seconds: number) => void
}) {
  const matches = text.match(/\[\d{1,2}:\d{2}(?::\d{2})?\]|\b\d{1,2}:\d{2}\b/g)
  if (!matches || !matches.length || !onSeek) return null

  const uniqueTimestamps = Array.from(new Set(matches))

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 pt-1 border-t border-dashed border-border/50">
      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
        <Clock className="size-2.5" /> Tua tới:
      </span>
      {uniqueTimestamps.map((ts) => {
        const seconds = parseTimestampToSeconds(ts)
        if (seconds == null) return null
        return (
          <button
            key={ts}
            type="button"
            onClick={() => onSeek(seconds)}
            className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary hover:bg-primary/20 transition-colors"
            title={`Bấm để tua audio tới ${ts}`}
          >
            {ts}
          </button>
        )
      })}
    </div>
  )
}
