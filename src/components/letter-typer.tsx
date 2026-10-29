import { useEffect, useRef, useState } from 'react'

import { Switch } from '#/components/ui/switch'
import { useStoredToggle } from '#/hooks/use-stored-toggle'
import { cn } from '#/lib/utils'

/** chữ cái/số phải gõ; dấu cách, gạch nối, nháy… tự điền */
const typeable = (c: string) => /[\p{L}\p{N}]/u.test(c)
const fold = (c: string) => c.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
const skipToTypeable = (target: string, from: number) => {
  let i = from
  while (i < target.length && !typeable(target[i])) i++
  return i
}

export interface TypingStats {
  mistakes: number
  hints: number
  gaveUp: boolean
}

/**
 * Gõ từng chữ cái của một từ/cụm: sai thì báo đỏ và không đi tiếp, Tab hiện chữ kế tiếp, Esc hiện mờ đáp án.
 * Dùng chung cho chế độ gõ từ của thẻ và tab Từ vựng trong video. Đổi từ thì parent đổi `key` để reset.
 */
export function useLetterTyper(
  target: string,
  opts: {
    /** Space (dấu cách không cần gõ) → nghe lại */
    onReplay: () => void
    onComplete: (stats: TypingStats) => void
  },
) {
  const [pos, setPos] = useState(() => skipToTypeable(target, 0))
  const [mistakes, setMistakes] = useState(0)
  const [hints, setHints] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)
  const [wrong, setWrong] = useState<{ at: number; ch: string; n: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const done = pos >= target.length

  useEffect(() => inputRef.current?.focus(), [])

  // chữ sai chỉ nháy đỏ một lúc
  useEffect(() => {
    if (!wrong) return
    const t = setTimeout(() => setWrong(null), 600)
    return () => clearTimeout(t)
  }, [wrong])

  const advance = (to: number, stats: TypingStats) => {
    setPos(to)
    if (to >= target.length) opts.onComplete(stats)
  }

  const typeChars = (chars: string) => {
    if (done) return
    let p = pos
    for (const ch of chars) {
      if (p >= target.length) break
      if (ch === ' ') {
        opts.onReplay()
        continue
      }
      if (fold(ch) !== fold(target[p])) {
        setMistakes((n) => n + 1)
        setWrong((w) => ({ at: p, ch, n: (w?.n ?? 0) + 1 }))
        break
      }
      p = skipToTypeable(target, p + 1)
    }
    if (p !== pos) advance(p, { mistakes, hints, gaveUp })
  }

  const hint = () => {
    if (done) return
    setHints(hints + 1)
    advance(skipToTypeable(target, pos + 1), { mistakes, hints: hints + 1, gaveUp })
    inputRef.current?.focus()
  }

  const giveUp = () => {
    setGaveUp(true)
    opts.onReplay()
    inputRef.current?.focus()
  }

  return { target, pos, mistakes, hints, gaveUp, wrong, done, inputRef, typeChars, hint, giveUp }
}

export type LetterTyper = ReturnType<typeof useLetterTyper>

/** ô chữ cái (tách theo từ để xuống dòng đúng chỗ với cụm dài) + ô nhập ẩn nhận phím */
export function LetterSlots({
  typer,
  onEnter,
  className,
}: {
  typer: LetterTyper
  /** Enter sau khi gõ xong */
  onEnter?: () => void
  className?: string
}) {
  const { target, pos, wrong, gaveUp, done } = typer
  const words = [...target.matchAll(/\S+/g)]
  return (
    <>
      <div
        className={cn('flex max-w-full flex-wrap justify-center gap-x-5 gap-y-3 font-mono text-3xl', className)}
        onClick={() => typer.inputRef.current?.focus()}
      >
        {words.map((m) => (
          <span key={m.index} className="flex gap-1.5">
            {[...m[0]].map((ch, j) => {
              const i = m.index + j
              if (!typeable(ch)) return <span key={i} className="text-muted-foreground">{ch}</span>
              const isWrong = wrong?.at === i
              return (
                <span
                  key={isWrong ? `${i}-${wrong.n}` : i}
                  className={cn(
                    'grid w-[1.1em] place-items-center border-b-2 pb-0.5',
                    i < pos ? 'border-ok text-ok' : i === pos && !done ? 'border-primary' : 'border-muted-foreground/40',
                    isWrong && 'type-shake border-bad text-bad',
                  )}
                >
                  {i < pos ? ch : isWrong ? wrong.ch : gaveUp ? <span className="opacity-30">{ch}</span> : ' '}
                </span>
              )
            })}
          </span>
        ))}
      </div>
      <input
        ref={typer.inputRef}
        className="sr-only"
        aria-label="Gõ từ"
        autoComplete="off"
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        value=""
        onChange={(e) => typer.typeChars(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Tab' && !done) {
            e.preventDefault()
            typer.hint()
          } else if (e.key === 'Escape' && !done) typer.giveUp()
          else if (e.key === 'Enter' && done) onEnter?.()
        }}
      />
    </>
  )
}

/** công tắc tự sang từ/thẻ tiếp sau khi gõ xong, dùng chung cho thẻ từ và tab Từ vựng của video */
export const useAutoNext = () => useStoredToggle('typing.auto-next')

export function AutoNextSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground" title="Gõ xong tự chuyển tiếp">
      <Switch checked={on} onCheckedChange={onChange} />
      Tự chuyển tiếp
    </label>
  )
}

/** sẵn sàng (gõ xong) và đang bật → chờ một chút cho nghe hết từ/xem kết quả rồi gọi next; bấm Enter vẫn đi ngay */
export function useAutoAdvance(ready: boolean, enabled: boolean, next: () => void, delayMs = 1500) {
  const nextRef = useRef(next)
  nextRef.current = next
  useEffect(() => {
    if (!ready || !enabled) return
    const t = setTimeout(() => nextRef.current(), delayMs)
    return () => clearTimeout(t)
  }, [ready, enabled, delayMs])
}
