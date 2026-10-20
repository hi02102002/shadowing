import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { AudioLines, Lightbulb, Loader2, Volume2, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { playerActions } from '#/lib/player-store'
import { useAccent } from '#/hooks/use-app-settings'
import { canSpeak, speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { lookupWord } from '#/server/fns/dictionary'

export interface LookupTarget {
  text: string
  sentence: string
  startMs: number
  endMs: number
  /** vị trí của từ trên màn hình để đặt thẻ ngay dưới/trên nó */
  rect: { top: number; bottom: number; left: number }
}

const WIDTH = 360
const GAP = 8

export function WordLookupCard({
  target,
  onClose,
}: {
  target: LookupTarget
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // đổi UK/US ở đây là đổi giọng chuẩn của cả app
  const [accent, chooseAccent] = useAccent()
  const [pos, setPos] = useState<{ top: number; left: number }>({
    top: target.rect.bottom + GAP,
    left: target.rect.left,
  })

  const query = useQuery({
    queryKey: ['lookup', target.text.toLowerCase(), target.sentence],
    queryFn: () =>
      lookupWord({ data: { text: target.text, sentence: target.sentence } }),
    staleTime: Infinity,
    retry: false,
  })

  // giữ thẻ trong viewport: lật lên trên nếu bên dưới không đủ chỗ
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 240
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(WIDTH, vw - GAP * 2)
    const left = Math.min(Math.max(GAP, target.rect.left), vw - width - GAP)
    const below = target.rect.bottom + GAP
    const top =
      below + h > vh - GAP && target.rect.top - GAP - h > GAP
        ? target.rect.top - GAP - h
        : below
    setPos({ top, left })
  }, [target, query.status])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && onClose()
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [onClose])

  const d = query.data

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`Tra từ: ${target.text}`}
      className="fixed z-50 flex max-h-[70vh] flex-col overflow-y-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-xl animate-in fade-in-0 zoom-in-95"
      style={{
        top: pos.top,
        left: pos.left,
        width: `min(${WIDTH}px, calc(100vw - ${GAP * 2}px))`,
      }}
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">
            {d?.headword ?? target.text}
          </h3>
          <div className="flex flex-wrap items-baseline gap-x-2 text-sm text-muted-foreground">
            {d && (
              <>
                <IpaTag label="UK" ipa={d.ipa} active={accent === 'uk'} />
                <IpaTag label="US" ipa={d.ipaUs} active={accent === 'us'} />
              </>
            )}
            {d?.partOfSpeech && (
              <span className="italic">{d.partOfSpeech}</span>
            )}
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="-mr-2 -mt-1 size-7"
          onClick={onClose}
          aria-label="Đóng"
        >
          <X />
        </Button>
      </header>

      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => playerActions.playClip(target.startMs, target.endMs)}
        >
          <AudioLines />
          Nghe trong video
        </Button>
        {canSpeak() && (
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => speak(d?.headword ?? target.text, { accent })}
            >
              <Volume2 />
              Giọng chuẩn
            </Button>
            <div
              className="flex rounded-md border p-0.5"
              role="group"
              aria-label="Giọng đọc"
            >
              {(['uk', 'us'] as const).map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={accent === a}
                  onClick={() => {
                    chooseAccent(a)
                    speak(d?.headword ?? target.text, { accent: a })
                  }}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-medium',
                    accent === a
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {a.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 border-t pt-3 text-sm">
        {query.isPending && (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tra nghĩa theo ngữ
            cảnh…
          </p>
        )}

        {query.isError && (
          <div className="flex flex-col gap-2">
            <p className="text-destructive">{query.error.message}</p>
            <Link to="/settings" className="text-sm" onClick={onClose}>
              Mở Cài đặt AI →
            </Link>
          </div>
        )}

        {d && (
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Nghĩa trong câu này
              </div>
              <p className="mt-0.5 font-medium">{d.meaningInContext}</p>
              {d.otherMeanings.length > 0 && (
                <p className="mt-1 text-muted-foreground">
                  Nghĩa khác: {d.otherMeanings.join('; ')}
                </p>
              )}
            </div>
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground">EN:</span>{' '}
              {d.definitionEn}
            </p>
            {d.examples.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {d.examples.map((ex, i) => (
                  <li key={i} className="rounded-md bg-muted/60 px-2.5 py-1.5">
                    <button
                      type="button"
                      className="text-left hover:text-primary"
                      title="Nghe câu ví dụ"
                      onClick={() => speak(ex.en, { accent })}
                    >
                      {ex.en}
                    </button>
                    <div className="text-xs text-muted-foreground">{ex.vi}</div>
                  </li>
                ))}
              </ul>
            )}
            {d.pronunciationTip && (
              <p className="flex gap-1.5 text-muted-foreground">
                <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-miss" />
                {d.pronunciationTip}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function IpaTag({
  label,
  ipa,
  active,
}: {
  label: string
  ipa: string
  active: boolean
}) {
  if (!ipa) return null
  return (
    <span className={cn('flex items-baseline gap-1', !active && 'opacity-60')}>
      <span className="text-[10px] font-semibold">{label}</span>
      <span className="ipa">{ipa}</span>
    </span>
  )
}
