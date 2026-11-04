/** Nút dùng chung cho một chunk: nghe đọc, lưu thẻ ôn SRS, nói theo (shadow) có chấm phát âm */
import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BookmarkCheck,
  BookmarkPlus,
  Loader2,
  Mic,
  Volume2,
  X,
} from 'lucide-react'

import { DiffLegend, DiffView } from '#/components/diff-view'
import { RecordButton } from '#/components/record-button'
import { ScoreRing } from '#/components/score-ring'
import { Button } from '#/components/ui/button'
import { useAccent } from '#/hooks/use-app-settings'
import { useRecorder } from '#/hooks/use-recorder'
import { speak } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { saveChunkCard } from '#/server/fns/chunks'
import { assessDrill } from '#/server/fns/pronunciation'
import type { DrillResult } from '#/server/fns/pronunciation'

let clip: HTMLAudioElement | null = null

/** đọc to: có audio người thật (Common Voice) thì phát file, không thì TTS theo giọng trong Cài đặt */
export function useSay() {
  const [accent] = useAccent()
  return (text: string, audioUrl?: string | null) => {
    clip?.pause()
    if (audioUrl) {
      clip = new Audio(audioUrl)
      clip.play().catch(() => speak(text, { accent }))
      return
    }
    // "I want to …" → đọc phần chữ, bỏ dấu ba chấm
    speak(text.replace(/\s*(?:…|\.{3})\s*$/, ''), { accent })
  }
}

export function ListenButton({
  text,
  audioUrl,
  label,
  className,
}: {
  text: string
  audioUrl?: string | null
  /** chữ cạnh icon; không có thì chỉ hiện icon */
  label?: string
  className?: string
}) {
  const say = useSay()
  return (
    <Button
      type="button"
      size={label ? 'sm' : 'icon'}
      variant="ghost"
      title={audioUrl ? 'Nghe giọng người thật' : 'Nghe đọc'}
      aria-label={`Nghe: ${text}`}
      className={cn(
        !label && 'size-7 shrink-0 text-muted-foreground hover:text-foreground',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation()
        say(text, audioUrl)
      }}
    >
      <Volume2 /> {label}
    </Button>
  )
}

export function SaveChunkButton({
  target,
  saved,
  onSaved,
}: {
  target: { chunkId: string } | { userChunkId: number }
  saved: boolean
  onSaved?: () => void
}) {
  const queryClient = useQueryClient()
  const [done, setDone] = useState(saved)
  useEffect(() => setDone(saved), [saved])
  const save = useMutation({
    mutationFn: () => saveChunkCard({ data: target }),
    onSuccess: () => {
      setDone(true)
      onSaved?.()
      void queryClient.invalidateQueries({ queryKey: ['decks'] })
    },
  })
  return (
    <Button
      type="button"
      size="sm"
      variant={done ? 'secondary' : 'outline'}
      disabled={done || save.isPending}
      title={
        save.error?.message ??
        (done ? 'Đã có trong bộ thẻ Chunks' : 'Lưu vào bộ thẻ Chunks để ôn')
      }
      onClick={() => save.mutate()}
    >
      {save.isPending ? (
        <Loader2 className="animate-spin" />
      ) : done ? (
        <BookmarkCheck />
      ) : (
        <BookmarkPlus />
      )}
      {done ? 'Đã lưu' : 'Lưu thẻ'}
    </Button>
  )
}

/** nghe mẫu → ghi âm nói theo → chấm từng từ (assessDrill, tối đa 200 ký tự) */
export function ChunkShadow({
  text,
  audioUrl,
  onClose,
}: {
  text: string
  audioUrl?: string | null
  onClose: () => void
}) {
  const say = useSay()
  const target = text.replace(/\s*(?:…|\.{3})\s*$/, '').slice(0, 200)
  const [result, setResult] = useState<DrillResult | null>(null)
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    },
    [],
  )
  const assess = useMutation({
    mutationFn: (blob: Blob) => {
      const form = new FormData()
      form.set('text', target)
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
  const recorder = useRecorder({
    maxMs: 15_000,
    onStop: (blob) => {
      if (blob.size <= 2_000) return
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      urlRef.current = URL.createObjectURL(blob)
      setRecordingUrl(urlRef.current)
      assess.mutate(blob)
    },
  })

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-3">
      <div className="flex items-start gap-2">
        <p className="flex-1 font-medium">{target}</p>
        <ListenButton text={target} audioUrl={audioUrl} />
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Đóng"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
      <div className="flex flex-col items-center gap-1">
        <RecordButton
          recording={recorder.recording}
          busy={assess.isPending}
          level={recorder.level}
          elapsedMs={recorder.elapsedMs}
          label="Bấm để nói theo"
          onStart={() => {
            setResult(null)
            assess.reset()
            void recorder.start()
          }}
          onStop={recorder.stop}
        />
        {(recorder.error ?? assess.error?.message) && (
          <p className="text-center text-sm text-destructive">
            {recorder.error ?? assess.error?.message}
          </p>
        )}
      </div>
      {result && (
        <div className="flex flex-col gap-2 border-t pt-3 text-sm">
          <div className="flex items-center gap-3">
            <ScoreRing value={result.accuracy} label="Chính xác" size={60} />
            <DiffView
              tokens={result.tokens}
              className="min-w-0 flex-1 text-base"
            />
          </div>
          <DiffLegend />
          <p>
            <span className="text-muted-foreground">Máy nghe được: </span>
            <span className="italic">
              “{result.transcript || '(không nhận dạng được)'}”
            </span>
          </p>
          {result.feedback && (
            <p className="text-muted-foreground">{result.feedback.summary}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!recordingUrl}
              onClick={() =>
                recordingUrl && void new Audio(recordingUrl).play()
              }
            >
              <Mic /> Nghe lại giọng bạn
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => say(target, audioUrl)}
            >
              <Volume2 /> Nghe mẫu
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
