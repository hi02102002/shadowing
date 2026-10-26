import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BookmarkCheck, BookmarkPlus, Loader2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { decksQuery } from '#/lib/queries'
import { createDeck, removeWordCard, savedDecks, saveWordCard } from '#/server/fns/flashcards'

const STORE_KEY = 'save-deck'
const NEW_DECK = 'new'
/** chưa có bộ nào: lưu vào bộ mặc định "Từ vựng từ video" (server tự tạo) */
const DEFAULT = 'default'

/** bộ đã chọn lần trước, nhớ trong trình duyệt */
function useLastDeck() {
  const [deckId, setDeckId] = useState<number | null>(null)
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(STORE_KEY))
      if (v) setDeckId(v)
    } catch {
      /* private mode */
    }
  }, [])
  const change = (id: number) => {
    setDeckId(id)
    try {
      localStorage.setItem(STORE_KEY, String(id))
    } catch {
      /* private mode */
    }
  }
  return [deckId, change] as const
}

/**
 * Nút "Lưu thẻ" + chọn bộ thẻ để lưu từ đang tra. Dùng <select> gốc thay vì Radix Select:
 * menu của Radix nằm ngoài thẻ tra từ nên bấm vào sẽ làm thẻ tra từ tự đóng.
 */
export function SaveToDeck({
  text,
  sentence,
  segmentId,
  startMs,
  endMs,
  disabled,
}: {
  text: string
  sentence: string
  segmentId: number
  startMs: number
  endMs: number
  /** đợi tra nghĩa xong để thẻ lưu được nghĩa theo ngữ cảnh từ cache */
  disabled?: boolean
}) {
  const queryClient = useQueryClient()
  const { data: decks = [] } = useQuery(decksQuery())
  const [lastDeck, setLastDeck] = useLastDeck()
  // bộ đã bị xoá → lấy bộ đầu tiên
  const deckId = decks.find((d) => d.id === lastDeck)?.id ?? decks.at(0)?.id ?? null

  const savedKey = ['card-saved', text.toLowerCase()]
  const saved = useQuery({
    queryKey: savedKey,
    queryFn: () => savedDecks({ data: { text } }),
  })
  const isSaved = deckId != null && !!saved.data?.includes(deckId)

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['decks'] })
    void queryClient.invalidateQueries({ queryKey: ['cards'] })
    void queryClient.invalidateQueries({ queryKey: savedKey })
  }

  const save = useMutation({
    mutationFn: () =>
      saveWordCard({
        data: { text, sentence, segmentId, startMs: Math.round(startMs), endMs: Math.round(endMs), deckId },
      }),
    onSuccess: (res) => {
      setLastDeck(res.deckId)
      refresh()
    },
  })

  const remove = useMutation({
    mutationFn: (id: number) => removeWordCard({ data: { text, deckId: id } }),
    onSuccess: refresh,
  })

  const create = useMutation({
    mutationFn: (name: string) => createDeck({ data: { name } }),
    onSuccess: (deck) => {
      setLastDeck(deck.id)
      setNaming(false)
      setName('')
      refresh()
    },
  })

  // Electron không hỗ trợ window.prompt → nhập tên bộ mới ngay trong thẻ
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const onPick = (value: string) => {
    if (value === NEW_DECK) setNaming(true)
    else setLastDeck(Number(value))
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant={isSaved ? 'secondary' : 'outline'}
          disabled={save.isPending || remove.isPending || create.isPending || (!isSaved && disabled)}
          // bật/tắt: đã có trong bộ đang chọn thì bấm để bỏ ra
          onClick={() => (isSaved ? remove.mutate(deckId) : save.mutate())}
          aria-pressed={isSaved}
          title={isSaved ? 'Bấm để bỏ từ này khỏi bộ' : 'Lưu vào bộ thẻ để ôn lại'}
        >
          {save.isPending || remove.isPending ? (
            <Loader2 className="animate-spin" />
          ) : isSaved ? (
            <BookmarkCheck />
          ) : (
            <BookmarkPlus />
          )}
          {isSaved ? 'Đã lưu' : 'Lưu thẻ'}
        </Button>
        <select
          aria-label="Lưu vào bộ thẻ"
          className="h-8 max-w-40 min-w-0 truncate rounded-md border bg-background px-1.5 text-xs"
          value={naming ? NEW_DECK : (deckId ?? DEFAULT)}
          disabled={create.isPending}
          onChange={(e) => onPick(e.target.value)}
        >
          {decks.length === 0 && <option value={DEFAULT}>Từ vựng từ video</option>}
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          <option value={NEW_DECK}>+ Tạo bộ mới…</option>
        </select>
      </div>
      {naming && (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) create.mutate(name.trim())
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={120}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setNaming(false))}
            placeholder="Tên bộ thẻ mới"
            className="h-8 text-sm"
          />
          <Button size="sm" type="submit" disabled={!name.trim() || create.isPending}>
            {create.isPending ? <Loader2 className="animate-spin" /> : 'Tạo'}
          </Button>
        </form>
      )}
      {(save.error ?? remove.error ?? create.error) && (
        <p className="text-xs text-destructive">{(save.error ?? remove.error ?? create.error)?.message}</p>
      )}
    </div>
  )
}
