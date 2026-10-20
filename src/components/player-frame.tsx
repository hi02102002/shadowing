import type { RefObject } from 'react'
import { Captions, CaptionsOff } from 'lucide-react'

import { cn } from '#/lib/utils'

interface Props {
  /** iframe của player được gắn vào đây */
  hostRef: RefObject<HTMLDivElement | null>
  /** chế độ chép chính tả: che vùng phụ đề */
  hideCaptions: boolean
  coverOff: boolean
  onToggleCover: () => void
  className?: string
}

/** Khung 16:9 cho player nhúng + lớp che phụ đề ở chế độ chép chính tả */
export function PlayerFrame({ hostRef, hideCaptions, coverOff, onToggleCover, className }: Props) {
  const covered = hideCaptions && !coverOff

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-xl bg-black',
        className,
      )}
    >
      <div
        ref={hostRef}
        className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full"
      />
      {covered && (
        // dự phòng cho phụ đề "cứng" trong hình hoặc khi player vẫn hiện CC; không chặn click vào điều khiển
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%] backdrop-blur-xl bg-black/40 [mask-image:linear-gradient(to_bottom,transparent,black_22%)]"
        />
      )}
      {hideCaptions && (
        <button
          type="button"
          onClick={onToggleCover}
          className="absolute bottom-[27%] right-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white backdrop-blur hover:bg-black/75"
          title={covered ? 'Bỏ che vùng phụ đề' : 'Che vùng phụ đề'}
        >
          {covered ? (
            <CaptionsOff className="size-3.5" />
          ) : (
            <Captions className="size-3.5" />
          )}
          {covered ? 'Đang che phụ đề' : 'Che phụ đề'}
        </button>
      )}
    </div>
  )
}
