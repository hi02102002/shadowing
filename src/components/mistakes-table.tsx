import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown, Dumbbell, Search, Trash2 } from 'lucide-react'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { mistakeLabel } from '#/server/ai/prompts'
import { relativeTime } from '#/lib/format'
import { cn } from '#/lib/utils'
import type { MistakeRow } from '#/server/fns/review'

const features = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
  sortFns: { alphanumeric: sortFn_alphanumeric, basic: sortFn_basic, text: sortFn_text },
})

const SOURCE_LABEL: Record<string, string | undefined> = {
  dictation: 'Chép chính tả',
  pronunciation: 'Phát âm',
  grammar: 'Ngữ pháp',
}

const helper = createColumnHelper<typeof features, MistakeRow>()

interface Props {
  data: MistakeRow[]
  onDelete: (id: number) => void
}

export function MistakesTable({ data, onDelete }: Props) {
  const [typeFilter, setTypeFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')

  const columns = useMemo(
    () =>
      helper.columns([
        helper.accessor('word', {
          header: 'Từ',
          sortFn: 'text',
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="font-semibold">{row.original.word}</span>
              {row.original.ipa && <span className="ipa text-xs text-muted-foreground">{row.original.ipa}</span>}
            </div>
          ),
        }),
        helper.accessor('heard', {
          header: 'Bạn nghe/nói',
          enableSorting: false,
          cell: ({ getValue }) =>
            getValue() ? <span className="text-bad line-through">{getValue()}</span> : <span className="text-muted-foreground">—</span>,
        }),
        helper.accessor('type', {
          header: 'Loại lỗi',
          filterFn: 'equalsString',
          sortFn: 'text',
          cell: ({ getValue }) => (
            <Badge variant="secondary">{mistakeLabel(getValue())}</Badge>
          ),
        }),
        helper.accessor('source', {
          header: 'Nguồn',
          filterFn: 'equalsString',
          cell: ({ getValue }) => SOURCE_LABEL[getValue()] ?? getValue(),
        }),
        helper.accessor('explanation', {
          header: 'Giải thích',
          enableSorting: false,
          cell: ({ row }) => (
            <div className="max-w-md text-sm">
              <p>{row.original.explanation}</p>
              {row.original.tip && <p className="mt-1 text-muted-foreground">💡 {row.original.tip}</p>}
            </div>
          ),
        }),
        helper.accessor('count', {
          header: 'Số lần',
          sortFn: 'basic',
          cell: ({ getValue }) => (
            <span className={cn('font-mono', getValue() >= 3 && 'font-semibold text-bad')}>×{getValue()}</span>
          ),
        }),
        helper.accessor((r) => new Date(r.lastSeenAt).getTime(), {
          id: 'lastSeenAt',
          header: 'Gần nhất',
          sortFn: 'basic',
          enableGlobalFilter: false,
          cell: ({ row }) => <span className="text-xs text-muted-foreground">{relativeTime(row.original.lastSeenAt)}</span>,
        }),
        helper.display({
          id: 'actions',
          header: '',
          cell: ({ row }) => (
            <div className="flex justify-end gap-1">
              {row.original.grammarRef && (
                <Button size="icon" variant="ghost" className="size-8" asChild title="Làm lại bài tập">
                  <Link to="/grammar/$unitId" params={{ unitId: row.original.grammarRef.split('#')[0] }} search={{ tab: row.original.grammarRef.endsWith('#ai') ? 'ai' : 'exercises' }}>
                    <Dumbbell />
                  </Link>
                </Button>
              )}
              {row.original.youtubeId && row.original.segmentIdx != null && (
                <Button size="icon" variant="ghost" className="size-8" asChild title="Luyện lại câu chứa lỗi">
                  <Link
                    to={row.original.source === 'dictation' ? '/videos/$videoId/dictation' : '/videos/$videoId/pronounce'}
                    params={{ videoId: row.original.youtubeId }}
                    search={{ seg: row.original.segmentIdx }}
                  >
                    <Dumbbell />
                  </Link>
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                className="size-8 text-muted-foreground hover:text-destructive"
                title="Đã thuộc — xoá khỏi sổ lỗi"
                onClick={() => onDelete(row.original.id)}
              >
                <Trash2 />
              </Button>
            </div>
          ),
        }),
      ]),
    [onDelete],
  )

  const table = useTable({
    features,
    columns,
    data,
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: (column) => !['actions', 'count', 'lastSeenAt'].includes(column.id),
    initialState: { sorting: [{ id: 'count', desc: true }] },
  })

  const types = useMemo(() => [...new Set(data.map((d) => d.type))].sort(), [data])

  const applyColumnFilter = (id: 'type' | 'source', value: string) => {
    table.getColumn(id)?.setFilterValue(value || undefined)
  }

  const rows = table.getRowModel().rows

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm từ, giải thích…"
            className="pl-8"
            value={(table.state.globalFilter as string | undefined) ?? ''}
            onChange={(e) => table.setGlobalFilter(e.target.value)}
          />
        </div>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={typeFilter}
          onChange={(e) => {
            setTypeFilter(e.target.value)
            applyColumnFilter('type', e.target.value)
          }}
        >
          <option value="">Mọi loại lỗi</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {mistakeLabel(t)}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-md border bg-background px-2 text-sm"
          value={sourceFilter}
          onChange={(e) => {
            setSourceFilter(e.target.value)
            applyColumnFilter('source', e.target.value)
          }}
        >
          <option value="">Mọi nguồn</option>
          <option value="dictation">Chép chính tả</option>
          <option value="pronunciation">Phát âm</option>
          <option value="grammar">Ngữ pháp</option>
        </select>
        <span className="text-sm text-muted-foreground">{rows.length} lỗi</span>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  const canSort = header.column.getCanSort()
                  return (
                    <th key={header.id} className="px-3 py-2 text-left font-medium text-muted-foreground">
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <table.FlexRender header={header} />
                          {sorted === 'asc' ? (
                            <ArrowUp className="size-3" />
                          ) : sorted === 'desc' ? (
                            <ArrowDown className="size-3" />
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        <table.FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b align-top last:border-0 hover:bg-muted/30">
                {row.getAllCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5">
                    <table.FlexRender cell={cell} />
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-muted-foreground">
                  Không có lỗi nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
