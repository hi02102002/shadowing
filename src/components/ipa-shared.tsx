import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { useAccent } from '#/hooks/use-app-settings'
import { IPA_SOUNDS, splitExample } from '#/lib/ipa-sounds'
import { cn } from '#/lib/utils'
import { wordsIpa } from '#/server/fns/dictionary'

export type IpaMap = Map<string, string | null> | undefined

/** phiên âm một danh sách từ trong một lần gọi; key 'ipa' → tự tải lại khi đổi giọng */
export function useWordsIpa(scope: string, words: string[]): IpaMap {
  const { data } = useQuery({
    queryKey: ['ipa', 'drill', scope],
    queryFn: () => wordsIpa({ data: { words } }),
    staleTime: Infinity,
  })
  return useMemo(
    () =>
      data ? new Map(words.map((w, i) => [w, data[i]] as const)) : undefined,
    [data, words],
  )
}

/** âm chỉ có ở giọng kia (vd. /ɒ/ với giọng Mỹ) thì ẩn đi */
export function useAccentSounds() {
  const [accent] = useAccent()
  return useMemo(
    () => IPA_SOUNDS.filter((s) => !s.only || s.only === accent),
    [accent],
  )
}

export function AccentSwitch() {
  const [accent, chooseAccent] = useAccent()
  return (
    <div className="flex rounded-lg border p-0.5 text-sm">
      {(['us', 'uk'] as const).map((a) => (
        <button
          key={a}
          type="button"
          onClick={() => chooseAccent(a)}
          className={cn(
            'rounded-md px-3 py-1 text-muted-foreground transition-colors',
            accent === a && 'bg-primary text-primary-foreground',
          )}
        >
          {a === 'us' ? 'Giọng Mỹ' : 'Giọng Anh'}
        </button>
      ))}
    </div>
  )
}

/** từ ví dụ với chữ cái mang âm được gạch chân: "c[a]t" */
export function MarkedWord({
  example,
  className,
}: {
  example: string
  className?: string
}) {
  const { before, mark, after } = splitExample(example)
  return (
    <span className={cn('font-medium', className)}>
      {before}
      <span className="text-primary underline underline-offset-4">{mark}</span>
      {after}
    </span>
  )
}

export const shuffle = <T,>(xs: T[]) => {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
