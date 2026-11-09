import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Info,
  List,
  Play,
  RotateCcw,
  Sparkles,
  Square,
  Video,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { ShadowWebcamBubble } from '#/components/shadow-webcam-bubble'
import { useShadowSubmissionRecorder } from '#/hooks/use-shadow-submission-recorder'
import { formatTime } from '#/lib/format'
import { findSegmentIndex, playerActions, playerStore } from '#/lib/player-store'
import { cn } from '#/lib/utils'
import type { SegmentView } from '#/server/fns/videos'

interface VideoSubmissionBarProps {
  videoTitle: string
  segments: SegmentView[]
  currentIdx: number
  onSelectSegment: (idx: number) => void
  mode: 'shadow' | 'repeat'
}

type ScopeType = 'current' | 'from_current' | 'all' | 'custom'

export function VideoSubmissionBar({
  videoTitle,
  segments,
  currentIdx,
  onSelectSegment,
  mode,
}: VideoSubmissionBarProps) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [scope, setScope] = useState<ScopeType>('current')
  const [fromSeg, setFromSeg] = useState(0)
  const [toSeg, setToSeg] = useState(0)
  const [showAllList, setShowAllList] = useState(false)
  const [activeSegIdx, setActiveSegIdx] = useState(currentIdx)

  const targetRangeRef = useRef<{ fromIdx: number; toIdx: number } | null>(null)

  const recorder = useShadowSubmissionRecorder({
    onAutoStop: () => {
      playerActions.pause()
    },
  })

  // Khi mở dialog thiết lập, đồng bộ giá trị mặc định theo câu hiện tại
  const handleOpenSetup = () => {
    const validCurrent = Math.min(Math.max(0, currentIdx), Math.max(0, segments.length - 1))
    setFromSeg(validCurrent)
    setToSeg(validCurrent)
    setScope('current')
    setShowAllList(false)
    setSetupOpen(true)
  }

  // Đổi phạm vi nhanh
  const handleScopeChange = (type: ScopeType) => {
    setScope(type)
    const validCurrent = Math.min(Math.max(0, currentIdx), Math.max(0, segments.length - 1))
    const lastIdx = Math.max(0, segments.length - 1)

    if (type === 'current') {
      setFromSeg(validCurrent)
      setToSeg(validCurrent)
    } else if (type === 'from_current') {
      setFromSeg(validCurrent)
      setToSeg(lastIdx)
    } else if (type === 'all') {
      setFromSeg(0)
      setToSeg(lastIdx)
    } else {
      // custom: giữ nguyên hoặc mở rộng 3-5 câu
      setFromSeg(validCurrent)
      setToSeg(Math.min(validCurrent + 3, lastIdx))
    }
  }

  // Tính toán câu bắt đầu và kết thúc thực tế
  const actualFrom = Math.min(fromSeg, toSeg)
  const actualTo = Math.max(fromSeg, toSeg)
  const startSegment = segments[actualFrom]
  const endSegment = segments[actualTo]
  const selectedCount = actualTo - actualFrom + 1
  const estimatedDurationMs =
    startSegment && endSegment ? Math.max(0, endSegment.endMs - startSegment.startMs) : 0

  // Bắt đầu quay khi bấm xác nhận
  const handleConfirmStart = () => {
    setSetupOpen(false)
    targetRangeRef.current = { fromIdx: actualFrom, toIdx: actualTo }

    if (actualFrom < 0 || actualFrom >= segments.length) return
    const startSeg = segments[actualFrom]

    // Di chuyển tới câu bắt đầu trước khi quay
    onSelectSegment(actualFrom)

    void recorder.startRecordingFlow(() => {
      // Khi đếm ngược 3..2..1 hoàn tất:
      playerActions.setLoop(false)
      playerActions.clearRange()

      if (mode === 'shadow') {
        // Shadowing: phát video liên tục một mạch
        playerActions.seek(startSeg.startMs)
        playerActions.play()
      } else {
        // Luyện phát âm: phát mẫu câu đầu tiên
        playerActions.seek(startSeg.startMs)
        playerActions.playRange(startSeg.startMs, startSeg.endMs)
      }
    })
  }

  // Dừng quay thủ công
  const handleStopRecording = () => {
    playerActions.pause()
    recorder.stopRecording()
  }

  // Theo dõi thời gian phát khi đang quay (tự dừng khi phát hết dải câu)
  useEffect(() => {
    if (recorder.status !== 'recording') return

    const sub = playerStore.subscribe((state) => {
      const range = targetRangeRef.current
      if (!range) return

      if (range.toIdx >= 0 && range.toIdx < segments.length) {
        const endSeg = segments[range.toIdx]
        // Nếu phát vượt qua điểm kết thúc của câu cuối dải
        if (state.currentMs >= endSeg.endMs + 300) {
          playerActions.pause()
          recorder.stopRecording()
          return
        }

        // Cập nhật câu đang phát trên thanh trạng thái (không gọi onSelectSegment để tránh ngắt quãng playback)
        const currentSegIdx = findSegmentIndex(segments, state.currentMs)
        if (currentSegIdx >= 0 && currentSegIdx < segments.length) {
          setActiveSegIdx(currentSegIdx)
        }
      }
    })

    return () => {
      if (typeof sub === 'function') {
        ;(sub as () => void)()
      } else if (sub && typeof (sub as { unsubscribe?: () => void }).unsubscribe === 'function') {
        ;(sub as { unsubscribe: () => void }).unsubscribe()
      }
    }
  }, [recorder, segments])

  const isRecording = recorder.status === 'recording'
  const isCountdown = recorder.status === 'countdown'
  const hasWebcam = recorder.webcamStream != null

  const downloadFilename = `${mode === 'shadow' ? 'shadowing' : 'phat-am'}-${videoTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 30)}-${new Date().toISOString().slice(0, 10)}.webm`

  return (
    <>
      {/* Thanh công cụ quay bài nộp */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-gradient-to-r from-red-500/5 via-card to-card p-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            <Video className="size-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight text-foreground">
              Quay video bài nộp cô giáo ({mode === 'shadow' ? 'Shadowing' : 'Phát âm'})
            </h3>
            <p className="text-xs text-muted-foreground">
              Bật camera khẩu hình, quay màn hình kèm giọng nói để nộp bài
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút bật/tắt camera riêng biệt */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (hasWebcam) recorder.stopWebcam()
              else void recorder.startWebcam()
            }}
            className="gap-1.5 text-xs"
          >
            {hasWebcam ? (
              <>
                <CameraOff className="size-3.5 text-muted-foreground" />
                Tắt Camera
              </>
            ) : (
              <>
                <Camera className="size-3.5 text-primary" />
                Bật Camera
              </>
            )}
          </Button>

          {/* Nút bấm kích hoạt quay */}
          {isRecording ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={handleStopRecording}
              className="gap-1.5 font-medium shadow-sm animate-pulse"
            >
              <Square className="size-3.5" />
              Dừng & Xem lại ({formatTime(recorder.elapsedMs)})
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleOpenSetup}
              className="gap-1.5 bg-red-600 text-white hover:bg-red-700 font-medium shadow-sm"
            >
              <Video className="size-4" />
              Quay bài nộp
            </Button>
          )}
        </div>
      </div>

      {/* Floating Webcam bubble */}
      <ShadowWebcamBubble
        stream={recorder.webcamStream}
        recording={isRecording}
        elapsedMs={recorder.elapsedMs}
        onClose={recorder.stopWebcam}
        onStopRecording={handleStopRecording}
      />

      {/* Overlay đếm ngược */}
      {isCountdown && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in-50 duration-300 flex flex-col items-center gap-4">
            <div className="flex size-28 items-center justify-center rounded-full bg-red-500/20 border-2 border-red-500">
              <span className="font-mono text-7xl font-black text-white drop-shadow-lg">
                {recorder.countdown}
              </span>
            </div>
            <p className="text-xl font-medium text-white/95">
              Chuẩn bị bắt đầu {mode === 'shadow' ? 'Shadowing' : 'luyện phát âm'}...
            </p>
            <p className="text-xs text-white/70">
              Đang quay từ câu #{actualFrom + 1} đến câu #{actualTo + 1}
            </p>
          </div>
        </div>
      )}

      {/* Floating Status Bar khi đang quay */}
      {isRecording && (
        <div className="fixed top-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-red-500/40 bg-background/95 px-4 py-2 shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-semibold text-red-500">Đang quay bài nộp</span>
            <span className="font-mono text-xs font-medium text-foreground">
              {formatTime(recorder.elapsedMs)}
            </span>
          </div>

          <div className="h-4 w-px bg-border" />

          <span className="text-xs font-medium text-foreground">
            Câu {activeSegIdx + 1}/{segments.length}
          </span>

          <Button
            size="sm"
            variant="destructive"
            className="h-7 gap-1.5 rounded-full px-3 text-xs"
            onClick={handleStopRecording}
          >
            <Square className="size-3" />
            Dừng & Xem lại
          </Button>
        </div>
      )}

      {/* Dialog Thiết lập trước khi bấm bắt đầu */}
      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
                <Video className="size-4" />
              </div>
              <DialogTitle>
                Quay video bài nộp {mode === 'shadow' ? 'Shadowing' : 'Phát âm'}
              </DialogTitle>
            </div>
            <DialogDescription>
              Xem trước câu cần nộp, kiểm tra camera khẩu hình và bắt đầu quay.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-1 text-sm">
            {/* Trạng thái Camera */}
            <div className="flex items-center justify-between rounded-xl border bg-card p-3">
              <div className="flex items-center gap-2.5">
                <Camera className="size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium text-xs sm:text-sm">Camera khẩu hình khuôn mặt</p>
                  <p className="text-xs text-muted-foreground">
                    {hasWebcam
                      ? 'Camera đang hiển thị (có thể kéo thả, phóng to/thu nhỏ tuỳ ý)'
                      : 'Bật camera để cô chấm khẩu hình và phát âm'}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant={hasWebcam ? 'secondary' : 'default'}
                size="sm"
                onClick={() => {
                  if (hasWebcam) recorder.stopWebcam()
                  else void recorder.startWebcam()
                }}
                className="shrink-0"
              >
                {hasWebcam ? 'Đang bật' : 'Bật Camera'}
              </Button>
            </div>

            {/* Chọn phạm vi câu */}
            <div className="flex flex-col gap-2.5 rounded-xl border bg-card p-3.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Phạm vi câu nộp bài
                </label>
                <span className="text-xs font-medium text-primary">
                  {selectedCount} câu ({formatTime(estimatedDurationMs)})
                </span>
              </div>

              {/* Các nút chọn nhanh */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => handleScopeChange('current')}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all',
                    scope === 'current'
                      ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  <span className="text-xs">Câu hiện tại</span>
                  <span className="text-[11px] opacity-80 font-mono">Câu #{currentIdx + 1}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange('from_current')}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all',
                    scope === 'from_current'
                      ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  <span className="text-xs">Từ câu hiện tại</span>
                  <span className="text-[11px] opacity-80 font-mono">
                    #{currentIdx + 1} → #{segments.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange('all')}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all',
                    scope === 'all'
                      ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  <span className="text-xs">Toàn bài</span>
                  <span className="text-[11px] opacity-80 font-mono">1 → {segments.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleScopeChange('custom')}
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border p-2 text-center transition-all',
                    scope === 'custom'
                      ? 'border-primary bg-primary/10 text-primary font-semibold shadow-xs'
                      : 'hover:bg-muted text-muted-foreground',
                  )}
                >
                  <span className="text-xs">Tuỳ chọn dải</span>
                  <span className="text-[11px] opacity-80 font-mono">Tự chọn</span>
                </button>
              </div>

              {/* Bộ chọn dropdown & ô số chi tiết */}
              <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Từ câu:</span>
                  <select
                    value={actualFrom}
                    onChange={(e) => {
                      setScope('custom')
                      setFromSeg(Number(e.target.value))
                    }}
                    className="h-9 w-full truncate rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
                  >
                    {segments.map((s, i) => (
                      <option key={s.id} value={i}>
                        Câu {i + 1} ({formatTime(s.startMs)}): {s.text.slice(0, 42)}
                        {s.text.length > 42 ? '...' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-foreground">Đến câu:</span>
                  <select
                    value={actualTo}
                    onChange={(e) => {
                      setScope('custom')
                      setToSeg(Number(e.target.value))
                    }}
                    className="h-9 w-full truncate rounded-md border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-primary"
                  >
                    {segments.map((s, i) => (
                      <option key={s.id} value={i} disabled={i < actualFrom}>
                        Câu {i + 1} ({formatTime(s.endMs)}): {s.text.slice(0, 42)}
                        {s.text.length > 42 ? '...' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Card Xem trước nội dung câu rõ ràng (giải quyết câu hỏi "sao biết câu nào") */}
              <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-2">
                  <Sparkles className="size-3.5" />
                  <span>Xem trước nội dung câu sẽ quay:</span>
                </div>

                <div className="flex flex-col gap-2 text-xs">
                  {/* Câu bắt đầu */}
                  <div className="flex flex-col gap-0.5 rounded-md bg-background/80 p-2 border">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                      <span className="font-semibold text-foreground">
                        Câu #{actualFrom + 1} (Bắt đầu)
                      </span>
                      <span className="font-mono">
                        {startSegment ? formatTime(startSegment.startMs) : ''}
                      </span>
                    </div>
                    <p className="font-medium text-foreground italic">
                      "{startSegment?.text}"
                    </p>
                  </div>

                  {/* Nếu dải có nhiều câu, hiển thị thêm câu kết thúc */}
                  {selectedCount > 1 && (
                    <div className="flex flex-col gap-0.5 rounded-md bg-background/80 p-2 border">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground font-medium">
                        <span className="font-semibold text-foreground">
                          Câu #{actualTo + 1} (Kết thúc)
                        </span>
                        <span className="font-mono">
                          {endSegment ? formatTime(endSegment.endMs) : ''}
                        </span>
                      </div>
                      <p className="font-medium text-foreground italic">
                        "{endSegment?.text}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Nút bật tắt xem toàn bộ danh sách câu */}
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowAllList(!showAllList)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <List className="size-3.5" />
                  <span>
                    {showAllList ? 'Ẩn danh sách câu' : 'Xem danh sách toàn bộ các câu trong bài'}
                  </span>
                  {showAllList ? (
                    <ChevronUp className="size-3.5" />
                  ) : (
                    <ChevronDown className="size-3.5" />
                  )}
                </button>

                {showAllList && (
                  <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border bg-background p-1 divide-y text-xs">
                    {segments.map((seg, idx) => {
                      const isSelected = idx >= actualFrom && idx <= actualTo
                      const isCurrent = idx === currentIdx
                      return (
                        <div
                          key={seg.id}
                          className={cn(
                            'flex items-start justify-between gap-2 p-2 rounded transition-colors',
                            isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                          )}
                        >
                          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                              <span
                                className={cn(
                                  'font-semibold',
                                  isSelected ? 'text-primary' : 'text-foreground',
                                )}
                              >
                                #{idx + 1}
                              </span>
                              <span>[{formatTime(seg.startMs)} - {formatTime(seg.endMs)}]</span>
                              {isCurrent && (
                                <span className="rounded bg-amber-500/10 px-1 text-[10px] text-amber-600 font-sans">
                                  Đang chọn
                                </span>
                              )}
                            </div>
                            <p className="text-foreground leading-snug line-clamp-2">
                              {seg.text}
                            </p>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => {
                                setScope('custom')
                                setFromSeg(idx)
                                if (idx > actualTo) setToSeg(idx)
                              }}
                            >
                              Từ đây
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 px-1.5 text-[10px]"
                              onClick={() => {
                                setScope('custom')
                                setToSeg(idx)
                                if (idx < actualFrom) setFromSeg(idx)
                              }}
                            >
                              Đến đây
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Hướng dẫn thao tác */}
            <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                Khi bấm <b>Bắt đầu quay</b>, chọn <b>Tab này</b> trên bảng hỏi của trình duyệt (nhớ tích <i>Chia sẻ âm thanh của thẻ</i>). Sau đó màn hình sẽ đếm ngược <b>3.. 2.. 1..</b> rồi mới chính thức ghi hình.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleConfirmStart} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
              <Play className="size-4" />
              Bắt đầu quay ({selectedCount} câu)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Xem lại & Tải bài nộp */}
      <Dialog
        open={recorder.status === 'stopped' && recorder.recordedUrl != null}
        onOpenChange={(o) => {
          if (!o) recorder.resetRecording()
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-ok" />
              <DialogTitle>Xem lại video bài nộp</DialogTitle>
            </div>
            <DialogDescription>
              Kiểm tra khẩu hình khuôn mặt và giọng đọc của bạn trước khi nộp cho cô giáo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-2">
            {recorder.recordedUrl && (
              <video
                src={recorder.recordedUrl}
                controls
                autoPlay
                className="aspect-video w-full rounded-xl bg-black shadow-inner"
              />
            )}

            {recorder.recordedBlob && (
              <p className="text-center text-xs text-muted-foreground">
                Dung lượng: {(recorder.recordedBlob.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                recorder.resetRecording()
                setSetupOpen(true)
              }}
              className="gap-1.5"
            >
              <RotateCcw className="size-4" />
              Quay lại lần khác
            </Button>

            <div className="flex gap-2">
              <Button variant="outline" onClick={recorder.resetRecording}>
                Đóng
              </Button>
              {recorder.recordedUrl && (
                <Button asChild className="gap-1.5 bg-primary text-primary-foreground">
                  <a href={recorder.recordedUrl} download={downloadFilename}>
                    <Download className="size-4" />
                    Tải video về máy (.webm)
                  </a>
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
