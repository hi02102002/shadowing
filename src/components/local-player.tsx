import { useEffect, useRef, useState } from 'react'
import { useThrottledCallback } from '@tanstack/react-pacer'
import { AudioLines } from 'lucide-react'

import { PlayerFrame } from '#/components/player-frame'
import { PLAYER_STATE, playerActions } from '#/lib/player-store'
import type { YTPlayer } from '#/lib/player-store'
import { localMediaUrl } from '#/lib/video-source'

const POLL_MS = 40

/** Bọc thẻ <video> thành giao diện YTPlayer để dùng chung player-store (currentTime chính xác, không cần nội suy) */
function adaptMedia(el: HTMLVideoElement): YTPlayer {
  return {
    playVideo: () => void el.play().catch(() => {}),
    pauseVideo: () => el.pause(),
    seekTo: (seconds) => {
      el.currentTime = Math.max(0, seconds)
    },
    getCurrentTime: () => el.currentTime,
    getPlayerState: () => {
      if (el.ended) return PLAYER_STATE.ENDED
      if (el.paused) return PLAYER_STATE.PAUSED
      // đang chờ dữ liệu sau khi tua
      return el.readyState < 3 ? PLAYER_STATE.BUFFERING : PLAYER_STATE.PLAYING
    },
    setPlaybackRate: (rate) => {
      el.playbackRate = rate
    },
    getAvailablePlaybackRates: () => [0.5, 0.75, 0.9, 1, 1.25, 1.5, 2],
    destroy: () => el.pause(),
  }
}

interface Props {
  mediaKey: string
  className?: string
  hideCaptions?: boolean
}

export function LocalPlayer({ mediaKey, className, hideCaptions = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [coverOff, setCoverOff] = useState(false)
  // file chỉ có tiếng (mp3, m4a…): hiện biểu tượng thay cho khung hình đen
  const [audioOnly, setAudioOnly] = useState(false)

  const publish = useThrottledCallback((ms: number, playing: boolean) => playerActions.setPlayback(ms, playing), {
    wait: 120,
    leading: true,
    trailing: true,
  })

  useEffect(() => {
    if (!hostRef.current) return
    const el = document.createElement('video')
    el.src = localMediaUrl(mediaKey)
    el.controls = true
    el.playsInline = true
    el.preload = 'auto'
    el.className = 'size-full bg-black object-contain'
    hostRef.current.replaceChildren(el)

    const player = adaptMedia(el)
    let timer: ReturnType<typeof setInterval> | undefined
    const onReady = () => {
      setAudioOnly(el.videoWidth === 0)
      playerActions.attach(player)
      timer = setInterval(() => {
        const ms = Math.round(el.currentTime * 1000)
        const { playing, changed } = playerActions.tick(ms, player.getPlayerState())
        if (changed) playerActions.setPlayback(ms, playing)
        else publish(ms, playing)
      }, POLL_MS)
    }
    el.addEventListener('loadedmetadata', onReady, { once: true })

    return () => {
      el.removeEventListener('loadedmetadata', onReady)
      clearInterval(timer)
      playerActions.detach()
      el.pause()
      el.removeAttribute('src')
      el.load()
    }
  }, [mediaKey, publish])

  useEffect(() => {
    if (!hideCaptions) setCoverOff(false)
  }, [hideCaptions])

  return (
    <div className="relative">
      <PlayerFrame
        hostRef={hostRef}
        // file local không có phụ đề nhúng, chỉ che khi có chữ cứng trong hình
        hideCaptions={hideCaptions && !audioOnly}
        coverOff={coverOff}
        onToggleCover={() => setCoverOff((v) => !v)}
        className={className}
      />
      {audioOnly && (
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-12 flex items-center justify-center text-white/30">
          <AudioLines className="size-16" />
        </div>
      )}
    </div>
  )
}
