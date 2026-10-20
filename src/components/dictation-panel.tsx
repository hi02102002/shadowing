import { useEffect, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, Eye, Lightbulb, Send, Sparkles } from 'lucide-react'

import { AiAnalysisToggle, AiFeedback } from '#/components/ai-feedback'
import { DiffLegend, DiffView } from '#/components/diff-view'
import { ScoreRing } from '#/components/score-ring'
import { Button } from '#/components/ui/button'
import { Textarea } from '#/components/ui/textarea'
import { useAiAnalysis } from '#/hooks/use-app-settings'
import { displayWords, firstLetterHint } from '#/lib/align'
import { playerActions } from '#/lib/player-store'
import { dictationHistoryQuery, videoQuery } from '#/lib/queries'
import { relativeTime } from '#/lib/format'
import { analyzeDictation, submitDictation } from '#/server/fns/dictation'
import type { SegmentView } from '#/server/fns/videos'

interface Props {
  youtubeId: string
  segment: SegmentView
  hasNext: boolean
  onNext: () => void
}

type HintLevel = 0 | 1 | 2

export function DictationPanel({ youtubeId, segment, hasNext, onNext }: Props) {
  const queryClient = useQueryClient()
  const [hint, setHint] = useState<HintLevel>(0)
  const [revealed, setRevealed] = useState(false)
  // bấm "Nhờ AI phân tích" / "Giải thích nối âm"
  const [askedAi, setAskedAi] = useState(false)
  const [autoAi] = useAiAnalysis()
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const submit = useMutation({
    mutationFn: (input: string) => submitDictation({ data: { segmentId: segment.id, input } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: videoQuery(youtubeId).queryKey })
      void queryClient.invalidateQueries({ queryKey: dictationHistoryQuery(segment.id).queryKey })
    },
  })
  const result = submit.data
  // tự phân tích khi sai (theo công tắc), hoặc khi người dùng bấm
  const wantAi = !!result && (askedAi || (autoAi && result.score < 100))

  const analysis = useQuery({
    queryKey: ['dictation-analysis', result?.attemptId],
    queryFn: () => analyzeDictation({ data: { attemptId: result!.attemptId } }),
    enabled: wantAi,
    staleTime: Infinity,
    retry: false,
  })

  const form = useForm({
    defaultValues: { input: '' },
    onSubmit: ({ value }) => submit.mutate(value.input),
  })

  const replay = () => playerActions.playRange(segment.startMs, segment.endMs)

  // đổi câu: reset form + tự phát câu mới
  useEffect(() => {
    form.reset()
    submit.reset()
    setHint(0)
    setRevealed(false)
    setAskedAi(false)
    const t = setTimeout(() => {
      replay()
      inputRef.current?.focus()
    }, 250)
    return () => clearTimeout(t)
  }, [segment.id])

  const wordCount = displayWords(segment.text).length
  const hintText =
    hint === 2 ? firstLetterHint(segment.text) : hint === 1 ? displayWords(segment.text).map((w) => '_'.repeat(Math.min(w.length, 8))).join(' ') : null

  return (
    <div className="flex flex-col gap-4">
      <form
        className="flex flex-col gap-3 rounded-xl border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault()
          void form.handleSubmit()
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="dictation-input" className="text-sm font-medium">
            Nghe và gõ lại câu <span className="text-muted-foreground">({wordCount} từ)</span>
          </label>
          <div className="flex items-center gap-1">
            <AiAnalysisToggle className="mr-2" />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setHint((h) => (h < 2 ? ((h + 1) as HintLevel) : 0))}
              disabled={!!result}
            >
              <Lightbulb />
              {hint === 0 ? 'Gợi ý' : hint === 1 ? 'Thêm gợi ý' : 'Ẩn gợi ý'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRevealed((r) => !r)}>
              <Eye />
              {revealed ? 'Ẩn đáp án' : 'Xem đáp án'}
            </Button>
          </div>
        </div>

        {hintText && !result && (
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-sm tracking-wide text-muted-foreground">{hintText}</p>
        )}
        {revealed && <p className="rounded-lg bg-accent px-3 py-2 text-accent-foreground">{segment.text}</p>}

        <form.Field
          name="input"
          validators={{ onSubmit: ({ value }) => (!value.trim() ? 'Hãy gõ những gì bạn nghe được' : undefined) }}
        >
          {(field) => (
            <>
              <Textarea
                id="dictation-input"
                ref={inputRef}
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                readOnly={!!result}
                rows={3}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                placeholder="Gõ câu bạn nghe được… (Enter để nộp, Ctrl+Space để nghe lại)"
                className="resize-none text-base"
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
                    e.preventDefault()
                    replay()
                  } else if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    if (result) onNext()
                    else void form.handleSubmit()
                  }
                }}
              />
              {field.state.meta.errors.length > 0 && (
                <p className="text-sm text-destructive">{field.state.meta.errors.join(', ')}</p>
              )}
            </>
          )}
        </form.Field>

        <div className="flex flex-wrap items-center gap-2">
          {!result ? (
            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" disabled={isSubmitting || submit.isPending}>
                  <Send />
                  {submit.isPending ? 'Đang chấm…' : 'Kiểm tra'}
                </Button>
              )}
            </form.Subscribe>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  submit.reset()
                  setAskedAi(false)
                  inputRef.current?.focus()
                }}
              >
                Làm lại
              </Button>
              {hasNext && (
                <Button type="button" onClick={onNext}>
                  Câu tiếp
                  <ChevronRight />
                </Button>
              )}
            </>
          )}
          {submit.error && <span className="text-sm text-destructive">{submit.error.message}</span>}
        </div>
      </form>

      {result && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center gap-4">
            <ScoreRing value={result.score} label="Điểm" size={64} />
            <div className="text-sm">
              {result.score === 100 ? (
                <p className="flex items-center gap-1.5 font-medium text-ok">
                  <CheckCircle2 className="size-4" /> Chính xác tuyệt đối!
                </p>
              ) : (
                <p>
                  Đúng <b>{result.correct}</b>/{result.refCount} từ
                </p>
              )}
            </div>
          </div>
          <DiffView tokens={result.tokens} />
          <DiffLegend />
        </div>
      )}

      {result && wantAi && (
        <AiFeedback
          status={analysis.status}
          error={analysis.error}
          summary={analysis.data?.summary}
          mistakes={analysis.data?.mistakes}
          connectedSpeech={analysis.data?.connectedSpeech}
          onRetry={() => void analysis.refetch()}
        />
      )}
      {result && !wantAi && (
        <Button variant="outline" className="self-start" onClick={() => setAskedAi(true)}>
          <Sparkles />
          {result.score < 100 ? 'Nhờ AI phân tích lỗi' : 'Giải thích nối âm trong câu'}
        </Button>
      )}

      <DictationHistory segmentId={segment.id} />
    </div>
  )
}

function DictationHistory({ segmentId }: { segmentId: number }) {
  const { data } = useQuery(dictationHistoryQuery(segmentId))
  if (!data?.length) return null
  return (
    <details className="rounded-xl border bg-card p-3 text-sm">
      <summary className="cursor-pointer select-none text-muted-foreground">Các lần làm trước ({data.length})</summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {data.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <span className="w-10 rounded bg-muted text-center font-mono text-xs">{Math.round(a.score)}</span>
            <span className="flex-1 truncate text-muted-foreground">{a.input}</span>
            <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(a.createdAt)}</span>
          </li>
        ))}
      </ul>
    </details>
  )
}
