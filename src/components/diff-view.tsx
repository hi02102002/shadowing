import { Tooltip, TooltipContent, TooltipTrigger } from '#/components/ui/tooltip'
import { cn } from '#/lib/utils'
import type { AlignToken } from '#/lib/align'

const STYLE: Record<AlignToken['op'], string> = {
  correct: 'text-ok',
  wrong: 'bg-bad-soft text-bad underline decoration-wavy decoration-1 underline-offset-4',
  missing: 'bg-miss-soft text-miss border border-dashed border-miss/60',
  extra: 'bg-extra-soft text-extra line-through',
}

const LABEL: Record<AlignToken['op'], string> = {
  correct: 'Đúng',
  wrong: 'Sai',
  missing: 'Thiếu',
  extra: 'Thừa',
}

/** Hiển thị câu gốc với từng từ được tô màu theo kết quả căn chỉnh; có `ipa` thì hiện phiên âm dưới từng từ của câu gốc */
export function DiffView({
  tokens,
  className,
  ipa,
}: {
  tokens: AlignToken[]
  className?: string
  ipa?: (word: string) => string | null | undefined
}) {
  return (
    <p className={cn('flex flex-wrap gap-x-1.5 gap-y-2 text-lg leading-relaxed', ipa && 'items-start gap-y-3', className)}>
      {tokens.map((t, i) => {
        const text = t.op === 'extra' ? t.hyp : t.ref
        const phonetic = ipa && t.op !== 'extra' ? ipa(t.ref) : null
        const word =
          t.op === 'correct' ? (
            <span className={STYLE.correct}>{text}</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className={cn('cursor-help rounded px-1', STYLE[t.op])}>{text}</span>
              </TooltipTrigger>
              <TooltipContent>
                {t.op === 'wrong' && (
                  <>
                    Bạn: <b>{t.hyp}</b> → đúng: <b>{t.ref}</b>
                  </>
                )}
                {t.op === 'missing' && <>Bạn bỏ sót từ này</>}
                {t.op === 'extra' && <>Từ thừa, câu gốc không có</>}
              </TooltipContent>
            </Tooltip>
          )
        if (!ipa) return <span key={i}>{word}</span>
        return (
          <span key={i} className="inline-flex flex-col items-center">
            {word}
            <span className="ipa text-xs leading-tight text-muted-foreground">{phonetic ? `/${phonetic}/` : '\u00a0'}</span>
          </span>
        )
      })}
    </p>
  )
}

export function DiffLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
      {(Object.keys(LABEL) as AlignToken['op'][]).map((op) => (
        <span key={op} className="flex items-center gap-1.5">
          <span className={cn('rounded px-1.5 py-0.5', STYLE[op])}>abc</span>
          {LABEL[op]}
        </span>
      ))}
    </div>
  )
}
