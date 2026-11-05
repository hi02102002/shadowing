import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Mic, Volume2 } from 'lucide-react'

import { DiffLegend, DiffView } from '#/components/diff-view'
import { useWordsIpa } from '#/components/ipa-shared'
import { RecordButton } from '#/components/record-button'
import { ScoreRing } from '#/components/score-ring'
import { Button } from '#/components/ui/button'
import { useRecorder } from '#/hooks/use-recorder'
import type { Accent } from '#/lib/speech'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import type { DrillFocus } from '#/server/ai/prompts'
import { assessDrill } from '#/server/fns/pronunciation'
import type { DrillResult } from '#/server/fns/pronunciation'

export interface DrillTarget {
  /** nhãn trên nút chọn câu */
  label: string
  text: string
  /** lưu ý riêng của câu, gửi kèm để AI nhận xét đúng ý bài */
  note?: string
}

/** bỏ dấu câu và chữ hoa để "Peas." khớp "peas" */
const normalizeWord = (w: string) =>
  w.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '')

/**
 * Chọn câu → nghe mẫu → ghi âm → chấm (điểm từng từ + nhận xét AI nếu đã cấu hình).
 * `focus`: trụ cột đang luyện, nhận xét sẽ bám vào đó; với "rhythm" hiện thêm tốc độ và chỗ ngắt dài.
 */
export function RecordDrill({
  targets,
  accent,
  focus,
}: {
  targets: DrillTarget[]
  accent: Accent
  focus?: DrillFocus
}) {
  const [index, setIndex] = useState(0)
  const target = targets[Math.min(index, targets.length - 1)]
  const text = target.text
  const [result, setResult] = useState<DrillResult | null>(null)

  // phiên âm từng từ của câu đang luyện, hiện dưới kết quả chấm
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text])
  const ipa = useWordsIpa(`drill:${text}`, words)
  const ipaOf = useMemo(() => {
    const byWord = new Map<string, string | null>()
    ipa?.forEach((v, w) => byWord.set(normalizeWord(w), v))
    return (w: string) => byWord.get(normalizeWord(w))
  }, [ipa])

  const assess = useMutation({
    mutationFn: (blob: Blob) => {
      const form = new FormData()
      form.set('text', text)
      if (focus) form.set('focus', focus)
      if (target.note) form.set('note', target.note)
      form.set(
        'audio',
        new File([blob], `rec.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`, {
          type: blob.type,
        }),
      )
      return assessDrill({ data: form })
    },
    onSuccess: setResult,
  })

  // bản ghi gần nhất để nghe lại giọng mình, so với giọng mẫu
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  useEffect(
    () => () => {
      if (recordingUrl) URL.revokeObjectURL(recordingUrl)
    },
    [recordingUrl],
  )
  const playRecording = () => {
    if (recordingUrl) void new Audio(recordingUrl).play()
  }

  const recorder = useRecorder({
    maxMs: 20_000,
    onStop: (blob) => {
      // bản ghi quá ngắn thường là bấm nhầm
      if (blob.size <= 2_000) return
      setRecordingUrl(URL.createObjectURL(blob))
      assess.mutate(blob)
    },
  })

  const pick = (i: number) => {
    setIndex(i)
    setResult(null)
    setRecordingUrl(null)
    assess.reset()
  }

  return (
    <div className="flex flex-col gap-4">
      {targets.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {targets.map((t, i) => (
            <button
              key={t.label + t.text}
              type="button"
              onClick={() => pick(i)}
              className={cn(
                'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                i === index
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3">
        <p className="flex-1 text-lg font-medium">{text}</p>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => speak(text, { accent })}
          aria-label="Nghe mẫu"
        >
          <Volume2 />
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <RecordButton
          recording={recorder.recording}
          busy={assess.isPending}
          level={recorder.level}
          elapsedMs={recorder.elapsedMs}
          onStart={() => {
            setResult(null)
            void recorder.start()
          }}
          onStop={recorder.stop}
        />
        {recorder.error && (
          <p className="text-sm text-destructive">{recorder.error}</p>
        )}
        {assess.error && (
          <p className="text-center text-sm text-destructive">
            {assess.error.message}
          </p>
        )}
      </div>

      {result && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-4">
            <ScoreRing value={result.accuracy} label="Chính xác" />
            <div className="min-w-0 flex-1">
              <DiffView
                tokens={result.tokens}
                ipa={ipaOf}
                className="text-base"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={playRecording}
              disabled={!recordingUrl}
            >
              <Mic /> Nghe lại giọng bạn
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => speak(text, { accent })}
            >
              <Volume2 /> Nghe mẫu
            </Button>
          </div>
          <DiffLegend />
          <p className="text-sm">
            <span className="text-muted-foreground">Máy nghe được: </span>
            <span className="italic">
              “{result.transcript || '(không nhận dạng được)'}”
            </span>
          </p>
          {focus === 'rhythm' &&
            (result.wpm != null || result.pauses.length > 0) && (
              <p className="text-sm text-muted-foreground">
                {result.wpm != null && <>Tốc độ: {result.wpm} từ/phút. </>}
                {result.pauses.length > 0
                  ? `Ngắt dài sau: ${result.pauses.map((p) => `“${p.after}” (${p.ms}ms)`).join(', ')}.`
                  : 'Không có chỗ ngắt dài.'}
              </p>
            )}
          {result.feedback && (
            <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3 text-sm">
              <p>{result.feedback.summary}</p>
              {result.feedback.mistakes.map((m) => (
                <div key={m.word + m.heard}>
                  <span className="font-medium">{m.word}</span>{' '}
                  <span className="ipa text-muted-foreground">{m.ipa}</span>
                  <p className="text-muted-foreground">
                    {m.explanation} {m.tip}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
