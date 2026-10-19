import { useEffect, useRef } from 'react'
import { useThrottledCallback } from '@tanstack/react-pacer'

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

export function YouTubePlayer({ videoId, className }: { videoId: string; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

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
        },
      })
    })

    return () => {
      cancelled = true
      clearInterval(timer)
      playerActions.detach()
      player?.destroy()
    }
  }, [videoId, publish])

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-xl bg-black', className)}>
      <div ref={hostRef} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />
    </div>
  )
}
