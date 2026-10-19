import { useEffect, useRef, useState } from 'react'
import { useThrottledCallback } from '@tanstack/react-pacer'
import { Captions, CaptionsOff } from 'lucide-react'

import { cn } from '#/lib/utils'
import { playerActions } from '#/lib/player-store'
import type { YTPlayer } from '#/lib/player-store'

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer
    }
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<void> | null = null
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve()
  apiPromise ??= new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve()
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    document.head.appendChild(s)
  })
  return apiPromise
}

const POLL_MS = 40

/** Tắt phụ đề CC của YouTube (YouTube tự bật theo tuỳ chọn tài khoản, bỏ qua cc_load_policy) */
function setYouTubeCaptions(player: YTPlayer, on: boolean) {
  try {
    for (const m of ['captions', 'cc']) {
      if (on) player.loadModule?.(m)
      else player.unloadModule?.(m)
    }
  } catch {
    /* player chưa sẵn sàng */
  }
}

interface Props {
  videoId: string
  className?: string
  /** chế độ chép chính tả: tắt CC của YouTube và che vùng phụ đề */
  hideCaptions?: boolean
}

export function YouTubePlayer({
  videoId,
  className,
  hideCaptions = false,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const hideRef = useRef(hideCaptions)
  hideRef.current = hideCaptions
  // người dùng có thể tạm bỏ lớp che (vd. video có chữ cứng trong hình cần xem)
  const [coverOff, setCoverOff] = useState(false)

  // cập nhật store tối đa ~8 lần/giây để transcript/karaoke không render quá dày
  const publish = useThrottledCallback(
    (ms: number, playing: boolean) => playerActions.setPlayback(ms, playing),
    { wait: 120, leading: true, trailing: true },
  )

  useEffect(() => {
    let player: YTPlayer | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    loadYouTubeApi().then(() => {
      if (cancelled || !hostRef.current || !window.YT) return
      const mount = document.createElement('div')
      hostRef.current.replaceChildren(mount)
      player = new window.YT.Player(mount, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          cc_load_policy: 0,
          iv_load_policy: 3,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled || !player) return
            playerRef.current = player
            if (hideRef.current) setYouTubeCaptions(player, false)
            playerActions.attach(player)
            timer = setInterval(() => {
              if (!player) return
              const ms = Math.round(player.getCurrentTime() * 1000)
              const state = player.getPlayerState()
              const { playing, changed } = playerActions.tick(ms, state)
              // đổi trạng thái play/pause thì cập nhật ngay, còn lại throttle
              if (changed) playerActions.setPlayback(ms, playing)
              else publish(ms, playing)
            }, POLL_MS)
          },
          // module phụ đề được nạp lại mỗi lần bắt đầu phát → tắt lại
          onStateChange: (e: { data: number }) => {
            if (player && hideRef.current && e.data === 1)
              setYouTubeCaptions(player, false)
          },
        },
      })
    })

    return () => {
      cancelled = true
      clearInterval(timer)
      playerActions.detach()
      playerRef.current = null
      player?.destroy()
    }
  }, [videoId, publish])

  // đổi chế độ khi player đang mở
  useEffect(() => {
    if (playerRef.current) setYouTubeCaptions(playerRef.current, !hideCaptions)
    if (!hideCaptions) setCoverOff(false)
  }, [hideCaptions])

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
        // dự phòng cho phụ đề "cứng" trong hình hoặc khi YouTube vẫn hiện CC; không chặn click vào điều khiển
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[26%] backdrop-blur-xl bg-black/40 [mask-image:linear-gradient(to_bottom,transparent,black_22%)]"
        />
      )}
      {hideCaptions && (
        <button
          type="button"
          onClick={() => setCoverOff((v) => !v)}
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
