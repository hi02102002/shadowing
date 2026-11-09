import { useEffect, useRef, useState } from 'react'
import { Circle, Maximize2, Move, Square, X } from 'lucide-react'

import { formatTime } from '#/lib/format'
import { cn } from '#/lib/utils'

interface ShadowWebcamBubbleProps {
  stream: MediaStream | null
  recording?: boolean
  elapsedMs?: number
  onClose: () => void
  onStopRecording?: () => void
}

type BubbleShape = 'circle' | 'rect'
type BubbleSize = 'sm' | 'md' | 'lg'

const SIZE_CONFIG: Record<
  BubbleShape,
  Record<BubbleSize, { w: number; h: number; className: string }>
> = {
  circle: {
    sm: { w: 140, h: 140, className: 'size-[140px] rounded-full' },
    md: { w: 200, h: 200, className: 'size-[200px] rounded-full' },
    lg: { w: 280, h: 280, className: 'size-[280px] rounded-full' },
  },
  rect: {
    sm: { w: 180, h: 110, className: 'w-[180px] h-[110px] rounded-2xl' },
    md: { w: 260, h: 160, className: 'w-[260px] h-[160px] rounded-2xl' },
    lg: { w: 340, h: 210, className: 'w-[340px] h-[210px] rounded-2xl' },
  },
}

export function ShadowWebcamBubble({
  stream,
  recording = false,
  elapsedMs,
  onClose,
  onStopRecording,
}: ShadowWebcamBubbleProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [shape, setShape] = useState<BubbleShape>('circle')
  const [size, setSize] = useState<BubbleSize>('md')
  const [hovered, setHovered] = useState(false)

  // Khởi tạo vị trí ở góc dưới bên phải
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 240) : 20,
    y: typeof window !== 'undefined' ? Math.max(20, window.innerHeight - 260) : 20,
  }))

  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })

  // Gắn stream vào video element
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  // Kéo thả pointer
  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true
    dragOffsetRef.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const currentConfig = SIZE_CONFIG[shape][size]
    const maxX = Math.max(10, window.innerWidth - currentConfig.w - 10)
    const maxY = Math.max(10, window.innerHeight - currentConfig.h - 10)

    const nextX = Math.min(Math.max(10, e.clientX - dragOffsetRef.current.x), maxX)
    const nextY = Math.min(Math.max(10, e.clientY - dragOffsetRef.current.y), maxY)

    setPos({ x: nextX, y: nextY })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false
    try {
      ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  const cycleSize = () => {
    setSize((prev) => (prev === 'sm' ? 'md' : prev === 'md' ? 'lg' : 'sm'))
  }

  const toggleShape = () => {
    setShape((prev) => (prev === 'circle' ? 'rect' : 'circle'))
  }

  if (!stream) return null

  const config = SIZE_CONFIG[shape][size]

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        touchAction: 'none',
      }}
      className={cn(
        'fixed z-50 flex cursor-grab select-none items-center justify-center overflow-visible shadow-2xl transition-shadow active:cursor-grabbing',
      )}
      title="Kéo thả camera đến vị trí mong muốn"
    >
      {/* Khung Camera thực tế */}
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden border-2 bg-black',
          recording
            ? 'border-red-500 ring-4 ring-red-500/30'
            : 'border-white/80 dark:border-white/40',
          config.className,
        )}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="pointer-events-none size-full scale-x-[-1] object-cover"
        />

        {/* Chấm đỏ REC ghi hình */}
        {recording && (
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            REC
          </div>
        )}

        {/* Thanh điều khiển nổi khi hover */}
        <div
          className={cn(
            'absolute inset-0 z-20 flex flex-col justify-between bg-black/40 p-2 text-white transition-opacity duration-200',
            hovered ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <div className="flex items-center justify-between">
            <span className="rounded bg-black/60 p-1 text-xs" title="Kéo để di chuyển">
              <Move className="size-3.5" />
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                onClose()
              }}
              className="rounded-full bg-black/60 p-1 hover:bg-red-600 transition-colors"
              title="Đóng / Tắt Camera"
              aria-label="Đóng Camera"
            >
              <X className="size-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                toggleShape()
              }}
              className="rounded-md bg-black/60 p-1.5 hover:bg-black/90"
              title={shape === 'circle' ? 'Chuyển sang khung chữ nhật' : 'Chuyển sang hình tròn'}
            >
              {shape === 'circle' ? (
                <Square className="size-3.5" />
              ) : (
                <Circle className="size-3.5" />
              )}
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                cycleSize()
              }}
              className="flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold hover:bg-black/90"
              title="Đổi kích thước (Nhỏ / Vừa / Lớn)"
            >
              <Maximize2 className="size-3" />
              {size.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* Nút DỪNG QUAY tiện lợi ngay dưới khung camera khi đang quay */}
      {recording && onStopRecording && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onStopRecording()
          }}
          className="absolute -bottom-9 left-1/2 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full bg-red-600 hover:bg-red-700 text-white px-3.5 py-1 text-xs font-semibold shadow-xl transition-all hover:scale-105 active:scale-95 cursor-pointer z-30"
          title="Bấm để dừng quay bài nộp và xem lại video"
        >
          <Square className="size-3 fill-white" />
          <span>Dừng quay</span>
          {elapsedMs != null && (
            <span className="font-mono text-[11px] opacity-90">({formatTime(elapsedMs)})</span>
          )}
        </button>
      )}
    </div>
  )
}
