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

/** Hiển thị câu gốc với từng từ được tô màu theo kết quả căn chỉnh */
export function DiffView({ tokens, className }: { tokens: AlignToken[]; className?: string }) {
  return (
    <p className={cn('flex flex-wrap gap-x-1.5 gap-y-2 text-lg leading-relaxed', className)}>
      {tokens.map((t, i) => {
        const text = t.op === 'extra' ? t.hyp : t.ref
        if (t.op === 'correct') {
          return (
            <span key={i} className={STYLE.correct}>
              {text}
            </span>
          )
        }
        return (
          <Tooltip key={i}>
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
