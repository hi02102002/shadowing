import { AlertCircle, Lightbulb, Loader2, Sparkles } from 'lucide-react'
import { Link } from '@tanstack/react-router'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { mistakeLabel } from '#/server/ai/prompts'
import type { DictationAnalysis, PronunciationFeedback } from '#/server/ai/prompts'

type Mistake = DictationAnalysis['mistakes'][number]

interface Props {
  status: 'pending' | 'error' | 'success'
  error?: unknown
  summary?: string
  mistakes?: Mistake[]
  connectedSpeech?: DictationAnalysis['connectedSpeech']
  drills?: PronunciationFeedback['drills']
  onRetry?: () => void
}

/** Khối phân tích AI dùng chung cho dictation và phát âm */
export function AiFeedback({ status, error, summary, mistakes, connectedSpeech, drills, onRetry }: Props) {
  if (status === 'pending') {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        AI đang phân tích lỗi…
      </div>
    )
  }

  if (status === 'error') {
    const msg = error instanceof Error ? error.message : String(error)
    const needsConfig = /API key|Cài đặt|Base URL|401|403/i.test(msg)
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-destructive">
          <AlertCircle className="size-4" />
          Không phân tích được bằng AI
        </div>
        <p className="text-muted-foreground">{msg}</p>
        <div className="flex gap-2">
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Thử lại
            </Button>
          )}
          {needsConfig && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/settings">Mở Cài đặt</Link>
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
      <header className="flex items-start gap-2">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm leading-relaxed">{summary}</p>
      </header>

      {!!mistakes?.length && (
        <ul className="flex flex-col gap-3">
          {mistakes.map((m, i) => (
            <li key={i} className="rounded-lg bg-muted/60 p-3">
              <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{m.word}</span>
                {m.ipa && <span className="ipa text-sm text-muted-foreground">{m.ipa}</span>}
                {m.heard && (
                  <span className="text-sm text-bad">
                    ← bạn: <span className="line-through">{m.heard}</span>
                  </span>
                )}
                <Badge variant="secondary" className="ml-auto">
                  {mistakeLabel(m.type)}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed">{m.explanation}</p>
              {m.tip && (
                <p className="mt-1.5 flex gap-1.5 text-sm text-muted-foreground">
                  <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-miss" />
                  {m.tip}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      {!!connectedSpeech?.length && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Nối âm & nuốt âm trong câu
          </h4>
          <ul className="flex flex-col gap-1.5 text-sm">
            {connectedSpeech.map((c, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium">{c.phrase}</span>
                <span className="text-muted-foreground">→</span>
                <span className="ipa rounded bg-accent px-1.5 text-accent-foreground">{c.sounds_like}</span>
                <span className="text-muted-foreground">{c.note}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!!drills?.length && (
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bài tập luyện lại</h4>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {drills.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
