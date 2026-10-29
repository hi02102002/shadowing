import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookOpen, ChevronDown, FileUp, FolderPlus, GraduationCap, Layers, Loader2, Pencil, Plus, Search, Settings2, Trash2 } from 'lucide-react'

import { AnkiImportDialog } from '#/components/anki-import-dialog'
import { EssentialImportDialog } from '#/components/essential-import-dialog'
import { StudySettingsDialog } from '#/components/study-settings-dialog'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { dueLabel } from '#/lib/format'
import { cardsQuery, decksQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'
import { addCard, createDeck, deleteCard, deleteDeck, renameDeck } from '#/server/fns/flashcards'
import type { DeckRow } from '#/server/fns/flashcards'

export const Route = createFileRoute('/flashcards/')({
  head: () => ({ meta: [{ title: 'Thẻ từ · Shadowing' }] }),
  component: Flashcards,
})

const STATE_LABEL = ['Mới', 'Đang học', 'Ôn tập', 'Học lại']
const SOURCE_LABEL: Record<string, string | undefined> = {
  anki: 'Anki',
  transcript: 'Video',
  custom: 'Tự tạo',
  essential: 'Essential English',
}

function Flashcards() {
  const queryClient = useQueryClient()
  const { data: decks = [], isLoading } = useQuery(decksQuery())
  const [selected, setSelected] = useState<number | null>(null)
  const [importing, setImporting] = useState(false)
  const [browsing, setBrowsing] = useState(false)
  const [tuning, setTuning] = useState(false)
  const [creating, setCreating] = useState(false)
  const deckId = selected ?? decks.at(0)?.id ?? null
  const current = decks.find((d) => d.id === deckId)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['decks'] })
    void queryClient.invalidateQueries({ queryKey: ['cards'] })
  }

  const totals = decks.reduce(
    (acc, d) => ({ newCount: acc.newCount + d.newCount, dueCount: acc.dueCount + d.dueCount }),
    { newCount: 0, dueCount: 0 },
  )

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end gap-3">
        <div className="flex flex-1 flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Layers className="size-6 text-primary" />
            Thẻ từ
          </h1>
          <p className="text-sm text-muted-foreground">
            Chuột phải vào một từ trong transcript rồi bấm “Lưu thẻ” để thêm vào đây. Lịch ôn tính bằng FSRS như Anki.
          </p>
        </div>
        <Button variant="outline" onClick={() => setCreating((v) => !v)}>
          <FolderPlus />
          Tạo bộ thẻ
        </Button>
        <Button variant="outline" size="icon" onClick={() => setTuning(true)} title="Cài đặt học" aria-label="Cài đặt học">
          <Settings2 />
        </Button>
        <Button variant="outline" onClick={() => setBrowsing(true)}>
          <BookOpen />
          Thư viện từ vựng
        </Button>
        <Button variant="outline" onClick={() => setImporting(true)}>
          <FileUp />
          Import Anki (.apkg)
        </Button>
        <Button asChild disabled={!totals.newCount && !totals.dueCount}>
          <Link to="/flashcards/study" search={{}}>
            <GraduationCap />
            Học tất cả
          </Link>
        </Button>
      </header>

      {creating && (
        <NameForm
          placeholder="Tên bộ thẻ mới, vd. IELTS Writing"
          submitLabel="Tạo"
          onCancel={() => setCreating(false)}
          onSubmit={async (name) => {
            const deck = await createDeck({ data: { name } })
            setCreating(false)
            setSelected(deck.id)
            refresh()
          }}
        />
      )}

      {isLoading ? (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : decks.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center text-muted-foreground">
          Chưa có thẻ nào. Tạo bộ thẻ, lưu từ khi xem video, thêm sách từ Thư viện từ vựng hoặc import một deck Anki.
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupDecks(decks).map((item) =>
              item.kind === 'book' ? (
                <BookGroup
                  key={`book:${item.book}`}
                  book={item.book}
                  decks={item.decks}
                  activeId={deckId}
                  onSelect={setSelected}
                  onChanged={refresh}
                />
              ) : (
                <DeckCard
                  key={item.deck.id}
                  deck={item.deck}
                  active={item.deck.id === deckId}
                  onSelect={() => setSelected(item.deck.id)}
                  onChanged={refresh}
                />
              ),
            )}
          </div>
          {current && (
            <h2 className="text-lg font-semibold">
              {current.book && <span className="text-muted-foreground">{current.book} · </span>}
              {current.name}
            </h2>
          )}
          {deckId != null && <CardList deckId={deckId} onChanged={refresh} />}
        </>
      )}

      <StudySettingsDialog open={tuning} onOpenChange={setTuning} />
      <EssentialImportDialog
        open={browsing}
        onOpenChange={setBrowsing}
        onImported={(id) => {
          refresh()
          setSelected(id)
        }}
      />
      <AnkiImportDialog
        open={importing}
        onOpenChange={setImporting}
        onImported={(id) => {
          refresh()
          setSelected(id)
        }}
      />
    </div>
  )
}

type DeckItem = { kind: 'deck'; deck: DeckRow } | { kind: 'book'; book: string; decks: DeckRow[] }

/** ref ee:<slug>:<unit>:<nhóm> → thứ tự trong sách */
function unitOrder(d: DeckRow) {
  const [, , unit = '0', part = '0'] = d.ref?.split(':') ?? []
  return Number(unit) * 1000 + Number(part)
}

/** bộ thẻ theo unit của cùng một sách gộp thành một nhóm, đặt ở vị trí unit được thêm sớm nhất */
function groupDecks(decks: DeckRow[]): DeckItem[] {
  const items: DeckItem[] = []
  const books = new Map<string, DeckRow[]>()
  for (const deck of decks) {
    if (!deck.book) {
      items.push({ kind: 'deck', deck })
      continue
    }
    let list = books.get(deck.book)
    if (!list) {
      list = []
      books.set(deck.book, list)
      items.push({ kind: 'book', book: deck.book, decks: list })
    }
    list.push(deck)
  }
  for (const list of books.values()) list.sort((a, b) => unitOrder(a) - unitOrder(b))
  return items
}

function BookGroup({
  book,
  decks,
  activeId,
  onSelect,
  onChanged,
}: {
  book: string
  decks: DeckRow[]
  activeId: number | null
  onSelect: (id: number) => void
  onChanged: () => void
}) {
  const [open, setOpen] = useState(() => decks.some((d) => d.id === activeId))
  const sum = (key: 'newCount' | 'dueCount' | 'total') => decks.reduce((n, d) => n + d[key], 0)
  const newCount = sum('newCount')
  const dueCount = sum('dueCount')

  return (
    <div className="col-span-full flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <ChevronDown className={cn('size-4 shrink-0 transition-transform', !open && '-rotate-90')} />
          <BookOpen className="size-4 shrink-0 text-primary" />
          <span className="truncate font-semibold">{book}</span>
          <span className="shrink-0 text-sm text-muted-foreground">{decks.length} bộ</span>
        </button>
        <span className="flex gap-3 text-sm">
          <span className="text-primary">{newCount} mới</span>
          <span className="text-ok">{dueCount} đến hạn</span>
          <span className="text-muted-foreground">{sum('total')} thẻ</span>
        </span>
        <Button size="sm" asChild disabled={!newCount && !dueCount}>
          <Link to="/flashcards/study" search={{ book }}>
            <GraduationCap />
            Học cả sách
          </Link>
        </Button>
      </div>
      {open && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              active={deck.id === activeId}
              onSelect={() => onSelect(deck.id)}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DeckCard({
  deck,
  active,
  onSelect,
  onChanged,
}: {
  deck: DeckRow
  active: boolean
  onSelect: () => void
  onChanged: () => void
}) {
  const [renaming, setRenaming] = useState(false)
  const remove = useMutation({
    mutationFn: () => deleteDeck({ data: { id: deck.id } }),
    onSuccess: onChanged,
  })

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border bg-card p-4 transition-colors',
        active && 'border-primary ring-1 ring-primary',
      )}
    >
      {renaming && (
        <NameForm
          initial={deck.name}
          submitLabel="Lưu"
          onCancel={() => setRenaming(false)}
          onSubmit={async (name) => {
            await renameDeck({ data: { id: deck.id, name } })
            setRenaming(false)
            onChanged()
          }}
        />
      )}
      <button type="button" className="flex flex-col gap-1 text-left" onClick={onSelect}>
        <span className={cn('flex items-center gap-2 font-semibold', renaming && 'hidden')}>
          <span className="truncate">{deck.name}</span>
          {/* bộ unit nằm trong nhóm sách, không cần nhãn nguồn */}
          {!deck.book && (
            <Badge variant="secondary" className="shrink-0">
              {SOURCE_LABEL[deck.source] ?? deck.source}
            </Badge>
          )}
        </span>
        <span className="flex gap-3 text-sm">
          <span className="text-primary">{deck.newCount} mới</span>
          <span className="text-ok">{deck.dueCount} đến hạn</span>
          <span className="text-muted-foreground">{deck.total} thẻ</span>
        </span>
      </button>
      <div className="flex items-center gap-1">
        <Button size="sm" asChild disabled={!deck.newCount && !deck.dueCount}>
          <Link to="/flashcards/study" search={{ deck: deck.id }}>
            <GraduationCap />
            Học
          </Link>
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="ml-auto size-8"
          title="Đổi tên"
          onClick={() => setRenaming((v) => !v)}
        >
          <Pencil />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-8 text-muted-foreground hover:text-destructive"
          title="Xoá bộ thẻ"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Xoá bộ “${deck.name}” cùng ${deck.total} thẻ?`)) remove.mutate()
          }}
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  )
}

function CardList({ deckId, onChanged }: { deckId: number; onChanged: () => void }) {
  const { data = [], isLoading } = useQuery(cardsQuery(deckId))
  const [q, setQ] = useState('')
  const remove = useMutation({
    mutationFn: (id: number) => deleteCard({ data: { id } }),
    onSuccess: onChanged,
  })

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data
    return data.filter((c) => `${c.front}\n${c.back}`.toLowerCase().includes(needle))
  }, [data, q])

  return (
    <section className="flex flex-col gap-3">
      <AddCardForm deckId={deckId} onAdded={onChanged} />
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm thẻ…" className="pl-8" />
      </div>
      {isLoading ? (
        <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Mặt trước</th>
                <th className="px-3 py-2 font-medium">Mặt sau</th>
                <th className="px-3 py-2 font-medium">Trạng thái</th>
                <th className="px-3 py-2 font-medium">Đến hạn</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="px-3 py-2">
                    <div className="font-semibold">{c.front}</div>
                    {c.ipa && <div className="ipa text-xs text-muted-foreground">{c.ipa}</div>}
                  </td>
                  <td className="max-w-md px-3 py-2 whitespace-pre-line">
                    {c.meaningVi && <div className="font-medium">{c.meaningVi}</div>}
                    <div className={cn(c.meaningVi && 'text-muted-foreground')}>{c.back}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{STATE_LABEL.at(c.state) ?? c.state}</Badge>
                    {c.lapses > 0 && <span className="ml-2 text-xs text-bad">quên ×{c.lapses}</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {c.state === 0 ? '—' : dueLabel(c.due)}
                  </td>
                  <td className="px-1 py-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      title="Xoá thẻ"
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Không có thẻ nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

/** ô nhập tên (tạo/đổi tên bộ thẻ) — không dùng window.prompt vì Electron không hỗ trợ */
function NameForm({
  initial = '',
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: string
  placeholder?: string
  submitLabel: string
  onSubmit: (name: string) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial)
  const submit = useMutation({ mutationFn: () => onSubmit(name.trim()) })
  return (
    <form
      className="flex max-w-md flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (name.trim()) submit.mutate()
      }}
    >
      <div className="flex gap-2">
        <Input
          autoFocus
          value={name}
          maxLength={120}
          placeholder={placeholder}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        />
        <Button type="submit" disabled={!name.trim() || submit.isPending}>
          {submit.isPending && <Loader2 className="animate-spin" />}
          {submitLabel}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Huỷ
        </Button>
      </div>
      {submit.error && <p className="text-sm text-destructive">{submit.error.message}</p>}
    </form>
  )
}

/** thêm thẻ bằng tay vào bộ đang xem */
function AddCardForm({ deckId, onAdded }: { deckId: number; onAdded: () => void }) {
  const empty = { front: '', back: '', ipa: '', example: '' }
  const [form, setForm] = useState(empty)
  const add = useMutation({
    mutationFn: () => addCard({ data: { deckId, ...form } }),
    onSuccess: () => {
      setForm(empty)
      onAdded()
    },
  })
  const field = (key: keyof typeof empty) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  })

  return (
    <form
      className="flex flex-col gap-2 rounded-xl border bg-card p-3"
      onSubmit={(e) => {
        e.preventDefault()
        if (form.front.trim()) add.mutate()
      }}
    >
      <div className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr_2fr_auto]">
        <Input placeholder="Từ / cụm từ *" maxLength={200} {...field('front')} />
        <Input placeholder="Nghĩa" maxLength={2000} {...field('back')} />
        <Input placeholder="IPA" maxLength={120} {...field('ipa')} />
        <Input placeholder="Câu ví dụ" maxLength={2000} {...field('example')} />
        <Button type="submit" disabled={!form.front.trim() || add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Thêm thẻ
        </Button>
      </div>
      {add.error && <p className="text-sm text-destructive">{add.error.message}</p>}
    </form>
  )
}
