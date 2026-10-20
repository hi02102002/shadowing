import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { useHotkey } from '@tanstack/react-hotkeys'
import { Link } from '@tanstack/react-router'
import { Cpu, Headphones, Play, Sparkles, Volume2 } from 'lucide-react'

import { AiAnalysisToggle, AiFeedback } from '#/components/ai-feedback'
import { DiffLegend, DiffView } from '#/components/diff-view'
import { RecordButton } from '#/components/record-button'
import { ScoreRing } from '#/components/score-ring'
import { Button } from '#/components/ui/button'
import { useAiAnalysis } from '#/hooks/use-app-settings'
import { useRecorder } from '#/hooks/use-recorder'
import { playerActions, playerStore } from '#/lib/player-store'
import { pronunciationEnginesQuery, pronunciationHistoryQuery, videoQuery } from '#/lib/queries'
import { relativeTime, scoreTone } from '#/lib/format'
import { cn } from '#/lib/utils'
import { assessPronunciation, pronunciationFeedback } from '#/server/fns/pronunciation'
import type {
  PronunciationEngine,
  PronunciationEngines,
  PronunciationResult,
} from '#/server/fns/pronunciation'
import type { SegmentView } from '#/server/fns/videos'

interface Props {
  youtubeId: string
  segment: SegmentView
  mode: 'shadow' | 'repeat'
}

type EngineChoice = PronunciationEngine | 'auto'

const ENGINE_LABEL: Record<EngineChoice, string> = {
  auto: 'Tự động',
  'llm-audio': 'AI nghe',
  stt: 'Whisper API',
  local: 'Trên máy',
}
const ENGINE_HINT: Record<EngineChoice, string> = {
  auto: 'Theo Cài đặt, thiếu cấu hình thì tự lùi về cách khác',
  'llm-audio': 'Model AI nghe trực tiếp bản ghi và nhận xét',
  stt: 'Nhận dạng giọng nói qua STT API rồi so từng từ',
  local: 'Whisper chạy ngay trên máy, không cần mạng hay API key',
}
const ENGINE_KEY = 'pronunciation-engine'

/** lựa chọn cách chấm, nhớ trong trình duyệt */
function useEngineChoice() {
  const [choice, setChoice] = useState<EngineChoice>('auto')
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ENGINE_KEY)
      if (saved === 'auto' || saved === 'llm-audio' || saved === 'local') setChoice(saved)
    } catch {
      /* private mode */
    }
  }, [])
  const change = (next: EngineChoice) => {
    setChoice(next)
    try {
      localStorage.setItem(ENGINE_KEY, next)
    } catch {
      /* private mode */
    }
  }
  return [choice, change] as const
}

/** thời gian chờ thêm sau khi câu gốc kết thúc trước khi tự dừng ghi âm (shadow) */
const SHADOW_TAIL_MS = 900

export function PronunciationPanel({ youtubeId, segment, mode }: Props) {
  const queryClient = useQueryClient()
  const [result, setResult] = useState<PronunciationResult | null>(null)
  const shadowingRef = useRef(false)
  const [engine, setEngine] = useEngineChoice()
  const engines = useQuery(pronunciationEnginesQuery())

  const assess = useMutation({
    mutationFn: (blob: Blob) => {
      const form = new FormData()
      form.set('segmentId', String(segment.id))
      form.set('mode', mode)
      form.set('engine', engine)
      form.set('audio', new File([blob], `rec.${blob.type.includes('mp4') ? 'm4a' : 'webm'}`, { type: blob.type }))
      return assessPronunciation({ data: form })
    },
    onSuccess: (r) => {
      setResult(r)
      setAskedAi(false)
      void queryClient.invalidateQueries({ queryKey: videoQuery(youtubeId).queryKey })
      void queryClient.invalidateQueries({ queryKey: pronunciationHistoryQuery(segment.id).queryKey })
    },
  })

  const recorder = useRecorder({
    maxMs: Math.max(15_000, (segment.endMs - segment.startMs) * 3),
    onStop: (blob) => {
      shadowingRef.current = false
      // bản ghi quá ngắn thường là bấm nhầm
      if (blob.size > 2_000) assess.mutate(blob)
    },
  })

  // Cài đặt tắt "AI tự phân tích lỗi" → chỉ gọi khi người dùng bấm
  const [askedAi, setAskedAi] = useState(false)
  const [autoAi] = useAiAnalysis()
  const wantAi = !!result?.aiFeedback && (autoAi || askedAi)
  const feedback = useQuery({
    queryKey: ['pronunciation-feedback', result?.attemptId],
    queryFn: () => pronunciationFeedback({ data: { attemptId: result!.attemptId } }),
    // chưa cấu hình LLM → chỉ có điểm chấm trên máy, không gọi AI nhận xét
    enabled: wantAi,
    staleTime: Infinity,
    retry: false,
  })

  // đổi câu → xoá kết quả cũ
  useEffect(() => {
    setResult(null)
    recorder.reset()
    assess.reset()
  }, [segment.id])

  // shadow: khi câu gốc phát xong thì tự dừng ghi âm
  const plays = useSelector(playerStore, (s) => s.plays)
  useEffect(() => {
    if (!shadowingRef.current || plays === 0) return
    const t = setTimeout(() => recorder.stop(), SHADOW_TAIL_MS)
    return () => clearTimeout(t)
  }, [plays, recorder])

  const startShadow = async () => {
    setResult(null)
    playerActions.setLoop(false)
    await recorder.start()
    shadowingRef.current = true
    playerActions.playRange(segment.startMs, segment.endMs)
  }

  const startRepeat = async () => {
    setResult(null)
    playerActions.pause()
    await recorder.start()
  }

  const onStart = mode === 'shadow' ? startShadow : startRepeat
  useHotkey('M', () => (recorder.recording ? recorder.stop() : void onStart()), { ignoreInputs: true })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-5">
        {mode === 'shadow' ? (
          <p className="flex items-center gap-2 text-center text-sm text-muted-foreground">
            <Headphones className="size-4" />
            Đeo tai nghe. Bấm ghi âm, video sẽ phát và bạn nói <b>cùng lúc</b> với người nói.
          </p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Nghe câu gốc (có thể lặp và giảm tốc độ), sau đó bấm ghi âm và <b>nhắc lại</b>.
          </p>
        )}
        <EnginePicker value={engine} onChange={setEngine} info={engines.data} />
        <AiAnalysisToggle />
        <RecordButton
          recording={recorder.recording}
          busy={assess.isPending}
          level={recorder.level}
          elapsedMs={recorder.elapsedMs}
          onStart={() => void onStart()}
          onStop={recorder.stop}
          label={mode === 'shadow' ? 'Bấm để shadow (M)' : undefined}
        />
        {recorder.error && <p className="text-sm text-destructive">{recorder.error}</p>}
        {assess.error && <p className="text-sm text-destructive">{assess.error.message}</p>}
      </div>

      {result && (
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-around gap-4">
            <ScoreRing value={result.accuracy} label="Chính xác" />
            <ScoreRing value={result.completeness} label="Đầy đủ" />
            {feedback.data && <ScoreRing value={feedback.data.fluency} label="Trôi chảy" />}
            <div className="flex flex-col items-center gap-1 text-sm">
              <span className="font-mono text-lg font-semibold">{result.wpm ?? '–'}</span>
              <span className="text-xs text-muted-foreground">từ/phút (gốc {result.refWpm ?? '–'})</span>
            </div>
          </div>

          <DiffView tokens={result.tokens} />
          <DiffLegend />

          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <span className="text-muted-foreground">Máy nghe được: </span>
            <span className="italic">“{result.transcript || '(không nhận dạng được)'}”</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {recorder.url && <audio src={recorder.url} controls className="h-9 max-w-full" />}
            <Button size="sm" variant="outline" onClick={() => playerActions.playRange(segment.startMs, segment.endMs)}>
              <Volume2 />
              Nghe bản gốc
            </Button>
          </div>
        </div>
      )}

      {result && !result.aiFeedback && (
        <div className="flex items-start gap-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          <Cpu className="mt-0.5 size-4 shrink-0" />
          <p>
            Đã chấm trên máy (chưa cấu hình AI). Nhập API key ở <Link to="/settings">Cài đặt</Link> để AI nhận xét chi
            tiết từng lỗi.
          </p>
        </div>
      )}

      {result?.aiFeedback && !wantAi && (
        <Button variant="outline" className="self-start" onClick={() => setAskedAi(true)}>
          <Sparkles />
          Nhờ AI phân tích lỗi
        </Button>
      )}

      {wantAi && (
        <AiFeedback
          status={feedback.status}
          error={feedback.error}
          summary={feedback.data?.summary}
          mistakes={feedback.data?.mistakes}
          drills={feedback.data?.drills}
          onRetry={() => void feedback.refetch()}
        />
      )}

      <PronunciationHistory segmentId={segment.id} />
    </div>
  )
}

function EnginePicker({
  value,
  onChange,
  info,
}: {
  value: EngineChoice
  onChange: (v: EngineChoice) => void
  info?: PronunciationEngines
}) {
  const options: Array<{ id: EngineChoice; unavailable: string | null }> = [
    { id: 'auto', unavailable: null },
    ...(info?.engines ?? []),
  ]
  const selected = options.find((o) => o.id === value)
  const needsModel =
    info && !info.localModelReady && (value === 'local' || (value === 'auto' && info.auto === 'local'))

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-1 text-xs" role="group" aria-label="Chấm bằng">
        <span className="mr-1 text-muted-foreground">Chấm bằng</span>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={o.id === value}
            disabled={!!o.unavailable}
            title={o.unavailable ?? ENGINE_HINT[o.id]}
            onClick={() => onChange(o.id)}
            className={cn(
              'rounded-md border px-2 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40',
              o.id === value ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
            )}
          >
            {ENGINE_LABEL[o.id]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected?.unavailable
          ? `${ENGINE_LABEL[value]} không dùng được: ${selected.unavailable}`
          : value === 'auto' && info
            ? `Đang dùng: ${ENGINE_LABEL[info.auto]}`
            : ENGINE_HINT[value]}
        {needsModel ? ' · lần đầu cần tải model Whisper' : ''}
      </p>
    </div>
  )
}

function PronunciationHistory({ segmentId }: { segmentId: number }) {
  const { data } = useQuery(pronunciationHistoryQuery(segmentId))
  if (!data?.length) return null
  return (
    <details className="rounded-xl border bg-card p-3 text-sm">
      <summary className="cursor-pointer select-none text-muted-foreground">Lịch sử luyện câu này ({data.length})</summary>
      <ul className="mt-2 flex flex-col gap-1.5">
        {data.map((a) => (
          <li key={a.id} className="flex items-center gap-3">
            <span
              className={cn(
                'w-10 rounded text-center font-mono text-xs',
                scoreTone(a.accuracy) === 'ok' && 'bg-ok-soft text-ok',
                scoreTone(a.accuracy) === 'miss' && 'bg-miss-soft text-miss',
                scoreTone(a.accuracy) === 'bad' && 'bg-bad-soft text-bad',
              )}
            >
              {Math.round(a.accuracy)}
            </span>
            <span className="flex-1 truncate italic text-muted-foreground">{a.transcript}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {a.mode === 'shadow' ? <Play className="inline size-3" /> : null} {relativeTime(a.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  )
}
