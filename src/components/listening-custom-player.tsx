import { useEffect, useRef, useState, useCallback } from 'react'
import {
  Clock,
  FileAudio,
  Link2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Repeat,
  Upload,
  Volume2,
  VolumeX,
  Youtube,
  Sparkles,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { YouTubePlayer } from '#/components/youtube-player'
import { parseYouTubeId } from '#/lib/youtube-id'
import { formatDuration } from '#/lib/format'
import { formatSecondsToTimestamp } from '#/lib/listening-note-types'
import { cn } from '#/lib/utils'

interface ListeningCustomPlayerProps {
  initialSourceType?: 'url' | 'file' | 'youtube' | 'sample'
  initialUrl?: string
  initialFileName?: string
  seekToTime?: number | null
  onTimeUpdate?: (time: number) => void
  onSourceChange?: (
    sourceType: 'url' | 'file' | 'youtube' | 'sample',
    url: string,
    fileName?: string,
  ) => void
  onInsertTimestamp?: (timestamp: string) => void
}

const SAMPLE_AUDIOS = [
  {
    name: 'BBC 6 Minute English: Smart Cities',
    url: 'https://archive.org/download/6_minute_english_2023_bbc/230105_6_minute_english_smart_cities.mp3',
  },
  {
    name: 'BBC 6 Minute English: Future of Food',
    url: 'https://archive.org/download/6_minute_english_2023_bbc/230112_6_minute_english_the_future_of_food.mp3',
  },
  {
    name: 'Cambridge IELTS Listening Sample',
    url: 'https://www.cambridgeenglish.org/images/153149-ielts-listening-sample-audio-1.mp3',
  },
]

const RATES = [0.75, 0.85, 1, 1.15, 1.25, 1.5] as const

export function ListeningCustomPlayer({
  initialSourceType = 'sample',
  initialUrl = SAMPLE_AUDIOS[0].url,
  initialFileName,
  seekToTime,
  onTimeUpdate,
  onSourceChange,
  onInsertTimestamp,
}: ListeningCustomPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [inputUrl, setInputUrl] = useState(initialUrl)
  const [activeUrl, setActiveUrl] = useState(initialUrl)
  const [sourceType, setSourceType] = useState<'url' | 'file' | 'youtube' | 'sample'>(initialSourceType)
  const [fileName, setFileName] = useState<string | undefined>(initialFileName)

  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [rate, setRate] = useState(1)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // A-B Loop State
  const [loopA, setLoopA] = useState<number | null>(null)
  const [loopB, setLoopB] = useState<number | null>(null)
  const [isLooping, setIsLooping] = useState(false)

  // Kiểm tra link YouTube
  const ytVideoId = parseYouTubeId(activeUrl)
  const isYouTube = !!ytVideoId && sourceType !== 'file'

  // Xử lý nạp link mới
  const handleApplyLink = useCallback(
    (urlToApply: string) => {
      const trimmed = urlToApply.trim()
      if (!trimmed) return
      setError(null)
      const ytId = parseYouTubeId(trimmed)
      if (ytId) {
        setSourceType('youtube')
        setActiveUrl(trimmed)
        setFileName(undefined)
        onSourceChange?.('youtube', trimmed, undefined)
      } else {
        const isSample = SAMPLE_AUDIOS.some((s) => s.url === trimmed)
        const type = isSample ? 'sample' : 'url'
        setSourceType(type)
        setActiveUrl(trimmed)
        setFileName(undefined)
        onSourceChange?.(type, trimmed, undefined)
      }
    },
    [onSourceChange],
  )

  // Xử lý chọn file audio từ máy
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const blobUrl = URL.createObjectURL(file)
    setSourceType('file')
    setActiveUrl(blobUrl)
    setFileName(file.name)
    setInputUrl(file.name)
    onSourceChange?.('file', blobUrl, file.name)
  }

  // Nhận tín hiệu seek từ bên ngoài (khi người dùng bấm vào mốc thời gian trong ghi chú)
  useEffect(() => {
    if (seekToTime == null) return
    if (audioRef.current) {
      audioRef.current.currentTime = seekToTime
      void audioRef.current.play().catch(() => {})
      setPlaying(true)
    }
  }, [seekToTime])

  // Lắng nghe sự kiện bàn phím Alt+Space, Alt+ArrowLeft, Alt+ArrowRight, Alt+M
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Chỉ kích hoạt khi nhấn tổ hợp Alt để tránh xung đột khi gõ chữ
      if (e.altKey && e.code === 'Space') {
        e.preventDefault()
        if (audioRef.current) {
          if (audioRef.current.paused) {
            void audioRef.current.play()
            setPlaying(true)
          } else {
            audioRef.current.pause()
            setPlaying(false)
          }
        }
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault()
        if (audioRef.current) {
          audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5)
        }
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault()
        if (audioRef.current) {
          audioRef.current.currentTime = Math.min(
            audioRef.current.duration || 9999,
            audioRef.current.currentTime + 5,
          )
        }
      } else if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault()
        const ts = formatSecondsToTimestamp(currentTime)
        onInsertTimestamp?.(ts)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentTime, onInsertTimestamp])

  // Xử lý A-B Loop khi audio chạy
  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    const cur = audioRef.current.currentTime
    setCurrentTime(cur)
    onTimeUpdate?.(cur)

    if (isLooping && loopA !== null && loopB !== null && loopB > loopA) {
      if (cur >= loopB) {
        audioRef.current.currentTime = loopA
      }
    }
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().then(() => setPlaying(true)).catch(() => {
        setError('Không thể phát file/link này. Vui lòng kiểm tra lại URL hoặc chọn file khác.')
      })
    }
  }

  const handleSeek = (newTime: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    }
  }

  const handleRateChange = (newRate: number) => {
    setRate(newRate)
    if (audioRef.current) {
      audioRef.current.playbackRate = newRate
    }
  }

  const toggleMute = () => {
    if (!audioRef.current) return
    audioRef.current.muted = !muted
    setMuted(!muted)
  }

  const handleVolumeChange = (v: number) => {
    setVolume(v)
    if (audioRef.current) {
      audioRef.current.volume = v
      if (v > 0 && muted) {
        audioRef.current.muted = false
        setMuted(false)
      }
    }
  }

  const setPointA = () => {
    setLoopA(currentTime)
    if (loopB !== null && loopB <= currentTime) {
      setLoopB(null)
      setIsLooping(false)
    }
  }

  const setPointB = () => {
    if (loopA !== null && currentTime > loopA) {
      setLoopB(currentTime)
      setIsLooping(true)
    } else {
      setLoopB(currentTime)
    }
  }

  const clearLoop = () => {
    setLoopA(null)
    setLoopB(null)
    setIsLooping(false)
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 sm:p-5 shadow-xs">
      {/* Thanh dán link hoặc chọn file */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleApplyLink(inputUrl)
            }}
            placeholder="Dán link audio (MP3, M4A, Podcast) hoặc link YouTube vào đây..."
            className="pr-20 text-sm"
          />
          <Button
            size="sm"
            variant="ghost"
            className="absolute right-1 top-1 h-7 px-2.5 text-xs text-primary font-medium"
            onClick={() => handleApplyLink(inputUrl)}
          >
            <Link2 className="size-3.5 mr-1" /> Nạp link
          </Button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="outline"
            className="flex items-center gap-1.5 text-xs sm:text-sm"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="size-3.5" />
            <span>Chọn file từ máy</span>
          </Button>

          {/* Menu audio mẫu */}
          <div className="relative group">
            <Button size="sm" variant="outline" className="flex items-center gap-1 text-xs">
              <Sparkles className="size-3 text-amber-500" />
              <span>Mẫu</span>
            </Button>
            <div className="absolute right-0 top-full z-20 mt-1 hidden w-64 rounded-xl border bg-popover p-1.5 shadow-lg group-hover:block">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase">
                Nghe thử bài mẫu
              </div>
              {SAMPLE_AUDIOS.map((sample) => (
                <button
                  key={sample.url}
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-xs text-popover-foreground hover:bg-muted truncate"
                  onClick={() => {
                    setInputUrl(sample.url)
                    handleApplyLink(sample.url)
                  }}
                >
                  {sample.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Thông tin nguồn audio đang nạp */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">Nguồn:</span>
        {isYouTube ? (
          <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-0.5 text-red-600 dark:text-red-400 font-medium">
            <Youtube className="size-3.5" /> YouTube Video
          </span>
        ) : sourceType === 'file' ? (
          <span className="inline-flex items-center gap-1 rounded bg-blue-500/10 px-2 py-0.5 text-blue-600 dark:text-blue-400 font-medium truncate max-w-xs">
            <FileAudio className="size-3.5" /> {fileName || 'File từ máy'}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-emerald-600 dark:text-emerald-400 font-medium truncate max-w-sm">
            <FileAudio className="size-3.5" /> {activeUrl}
          </span>
        )}

        {/* Nút chèn mốc thời gian nhanh */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto h-7 px-2.5 text-xs text-primary border-primary/30 hover:bg-primary/10"
          onClick={() => {
            const ts = formatSecondsToTimestamp(currentTime)
            onInsertTimestamp?.(ts)
          }}
          title="Chèn mốc thời gian hiện tại vào ghi chú (Phím tắt: Alt+M)"
        >
          <Clock className="size-3.5 mr-1" />
          <span>Chèn mốc {formatSecondsToTimestamp(currentTime)}</span>
        </Button>
      </div>

      {/* Thông báo lỗi nếu có */}
      {error && (
        <div className="rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Trường hợp YouTube Video */}
      {isYouTube && ytVideoId ? (
        <div className="flex flex-col gap-2 rounded-xl border bg-black/5 p-3">
          <div className="aspect-video w-full max-w-xl mx-auto overflow-hidden rounded-lg shadow-sm">
            <YouTubePlayer videoId={ytVideoId} />
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Đang phát qua YouTube Player nhúng. Có thể điều khiển âm lượng và tua trực tiếp trên player.
          </p>
        </div>
      ) : (
        /* Trình phát Audio HTML5 */
        <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-3 sm:p-4">
          <audio
            ref={audioRef}
            src={activeUrl}
            preload="metadata"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              if (audioRef.current) {
                setDuration(audioRef.current.duration)
                audioRef.current.playbackRate = rate
              }
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => {
              setError('Không thể phát file này. Hãy thử liên kết trực tiếp .mp3 hoặc tải file lên từ máy.')
              setPlaying(false)
            }}
          />

          {/* Timeline & Progress Bar */}
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs tabular-nums font-medium min-w-10">
              {formatDuration(currentTime) || '0:00'}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 100}
              step={0.5}
              value={currentTime}
              onChange={(e) => handleSeek(parseFloat(e.target.value))}
              className="flex-1 accent-primary h-2 cursor-pointer rounded-lg bg-muted-foreground/20"
              aria-label="Thanh thời gian nghe"
            />
            <span className="font-mono text-xs tabular-nums text-muted-foreground min-w-10 text-right">
              {formatDuration(duration) || '0:00'}
            </span>
          </div>

          {/* Điều khiển phát chính */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button
                size="sm"
                variant={playing ? 'secondary' : 'default'}
                className="h-9 px-4 font-medium"
                onClick={togglePlay}
              >
                {playing ? <Pause className="size-4 mr-1.5" /> : <Play className="size-4 mr-1.5" />}
                <span>{playing ? 'Tạm dừng' : 'Phát audio'}</span>
              </Button>

              <Button
                size="icon"
                variant="outline"
                className="size-9"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 5)
                  }
                }}
                title="Lùi 5 giây (Alt + ←)"
              >
                <RotateCcw className="size-4" />
              </Button>

              <Button
                size="icon"
                variant="outline"
                className="size-9"
                onClick={() => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = Math.min(
                      duration,
                      audioRef.current.currentTime + 5,
                    )
                  }
                }}
                title="Tiến 5 giây (Alt + →)"
              >
                <RotateCw className="size-4" />
              </Button>

              {/* Tốc độ phát */}
              <div className="flex items-center gap-1 ml-1">
                {RATES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => handleRateChange(r)}
                    className={cn(
                      'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                      rate === r
                        ? 'bg-foreground text-background'
                        : 'bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {r}x
                  </button>
                ))}
              </div>
            </div>

            {/* Điều khiển âm lượng */}
            <div className="hidden sm:flex items-center gap-2">
              <button
                type="button"
                onClick={toggleMute}
                className="text-muted-foreground hover:text-foreground"
                aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
              >
                {muted || volume === 0 ? (
                  <VolumeX className="size-4" />
                ) : (
                  <Volume2 className="size-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                className="w-20 accent-primary h-1.5 cursor-pointer rounded-lg bg-muted-foreground/20"
                aria-label="Thanh âm lượng"
              />
            </div>
          </div>

          {/* Tính năng Lặp A-B (A-B Repeat) rất hữu ích cho luyện nghe & shadowing */}
          <div className="flex flex-wrap items-center gap-2 border-t pt-2.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground flex items-center gap-1">
              <Repeat className="size-3.5" /> Lặp đoạn A-B:
            </span>
            <Button
              size="sm"
              variant={loopA !== null ? 'secondary' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={setPointA}
            >
              {loopA !== null ? `A: ${formatDuration(loopA)}` : 'Đặt mốc A (Bắt đầu)'}
            </Button>
            <Button
              size="sm"
              variant={loopB !== null ? 'secondary' : 'outline'}
              className="h-7 px-2 text-xs"
              onClick={setPointB}
            >
              {loopB !== null ? `B: ${formatDuration(loopB)}` : 'Đặt mốc B (Kết thúc)'}
            </Button>

            {loopA !== null && loopB !== null && (
              <Button
                size="sm"
                variant={isLooping ? 'default' : 'outline'}
                className="h-7 px-2 text-xs"
                onClick={() => setIsLooping(!isLooping)}
              >
                {isLooping ? 'Đang lặp A ⇄ B' : 'Bật lặp A ⇄ B'}
              </Button>
            )}

            {(loopA !== null || loopB !== null) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                onClick={clearLoop}
              >
                Xoá mốc
              </Button>
            )}

            <span className="ml-auto text-[11px] text-muted-foreground italic hidden md:inline">
              Mẹo: Nhấn Alt+Space để dừng/phát, Alt+M để chèn mốc thời gian.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
