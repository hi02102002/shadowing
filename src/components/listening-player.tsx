import { useRef, useState } from 'react'
import { useSelector } from '@tanstack/react-store'
import { Pause, Play, RotateCcw, Rewind } from 'lucide-react'

import type { ListeningMedia } from '#/lib/listening'
import { playerActions, playerStore } from '#/lib/player-store'
import { Button } from '#/components/ui/button'
import { VimeoPlayer } from '#/components/vimeo-player'

const RATES = [0.75, 1, 1.25] as const

export function ListeningPlayer({
  media,
  src,
  exam,
  errorMessage,
}: {
  media: ListeningMedia | null
  src?: string
  exam: boolean
  errorMessage?: string
}) {
  if (!media)
    return (
      <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        Section này chưa có audio.
      </p>
    )
  return media.kind === 'audio' ? (
    <AudioListeningPlayer
      src={src ?? media.url}
      exam={exam}
      errorMessage={errorMessage}
    />
  ) : (
    <VimeoListeningPlayer id={media.id} exam={exam} />
  )
}

function AudioListeningPlayer({
  src,
  exam,
  errorMessage,
}: {
  src: string
  exam: boolean
  errorMessage?: string
}) {
  const ref = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState(false)
  const [rate, setRate] = useState(1)
  const [error, setError] = useState(false)
  const play = () => {
    if (exam && ended) return
    setStarted(true)
    void ref.current?.play().catch(() => setError(true))
  }
  const replay = () => {
    if (!ref.current || exam) return
    ref.current.currentTime = 0
    void ref.current.play().catch(() => setError(true))
  }
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={() => setError(false)}
        onError={() => setError(true)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false)
          setEnded(true)
        }}
      />
      <Button
        className="w-full sm:w-auto"
        size="sm"
        disabled={exam && ended}
        onClick={() => (playing ? ref.current?.pause() : play())}
      >
        {playing ? <Pause /> : <Play />}{' '}
        {playing ? 'Tạm dừng' : ended && exam ? 'Đã nghe xong' : 'Nghe'}
      </Button>
      {!exam && (
        <>
          <Button
            size="icon"
            variant="outline"
            aria-label="Lùi 5 giây"
            onClick={() => {
              if (ref.current)
                ref.current.currentTime = Math.max(
                  0,
                  ref.current.currentTime - 5,
                )
            }}
          >
            <Rewind />
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Nghe lại từ đầu"
            onClick={replay}
          >
            <RotateCcw />
          </Button>
          <div
            className="ml-auto flex rounded-lg border p-0.5 sm:ml-0"
            aria-label="Tốc độ phát"
          >
            {RATES.map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-md px-2 py-1 font-mono text-xs ${rate === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                onClick={() => {
                  setRate(value)
                  if (ref.current) ref.current.playbackRate = value
                }}
              >
                {value}×
              </button>
            ))}
          </div>
        </>
      )}
      {exam && (
        <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
          {ended
            ? 'Đã dùng lượt nghe'
            : started
              ? 'Đang trong lượt nghe duy nhất'
              : 'Chỉ được phát một lần'}
        </span>
      )}
      {error && (
        <p role="alert" className="w-full text-sm text-destructive">
          {errorMessage ?? 'Không tải được audio của section này.'}
        </p>
      )}
    </div>
  )
}

function VimeoListeningPlayer({ id, exam }: { id: string; exam: boolean }) {
  const { ready, playing } = useSelector(playerStore, (state) => ({
    ready: state.ready,
    playing: state.playing,
  }))
  const [started, setStarted] = useState(false)
  const [ended, setEnded] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <VimeoPlayer
        vimeoId={id}
        hideCaptions
        nativeControls={false}
        onPlay={() => setStarted(true)}
        onEnded={() => setEnded(true)}
      />
      <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <Button
          className="w-full sm:w-auto"
          size="sm"
          disabled={!ready || (exam && ended)}
          onClick={() =>
            playing ? playerActions.pause() : playerActions.play()
          }
        >
          {playing ? <Pause /> : <Play />}{' '}
          {playing ? 'Tạm dừng' : ended && exam ? 'Đã nghe xong' : 'Nghe'}
        </Button>
        {!exam && (
          <>
            <Button
              size="icon"
              variant="outline"
              aria-label="Lùi 5 giây"
              onClick={() =>
                playerActions.seek(
                  Math.max(0, playerStore.state.currentMs - 5000),
                )
              }
            >
              <Rewind />
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Nghe lại từ đầu"
              onClick={() => {
                playerActions.seek(0)
                playerActions.play()
              }}
            >
              <RotateCcw />
            </Button>
            <div className="ml-auto flex rounded-lg border p-0.5 sm:ml-0">
              {RATES.map((rate) => (
                <button
                  key={rate}
                  type="button"
                  className="rounded-md px-2 py-1 font-mono text-xs text-muted-foreground hover:bg-muted"
                  onClick={() => playerActions.setRate(rate)}
                >
                  {rate}×
                </button>
              ))}
            </div>
          </>
        )}
        {exam && (
          <span className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
            {ended
              ? 'Đã dùng lượt nghe'
              : started
                ? 'Đang trong lượt nghe duy nhất'
                : 'Chỉ được phát một lần'}
          </span>
        )}
      </div>
    </div>
  )
}
