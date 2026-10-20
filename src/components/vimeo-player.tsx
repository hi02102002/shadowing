import { useEffect, useRef, useState } from 'react'
import { useThrottledCallback } from '@tanstack/react-pacer'

import { PlayerFrame } from '#/components/player-frame'
import { PLAYER_STATE, playerActions } from '#/lib/player-store'
import type { YTPlayer } from '#/lib/player-store'

/** Phần API của Vimeo Player (player.js) mà app dùng, mọi lệnh đều trả Promise */
interface VimeoApi {
  ready: () => Promise<void>
  play: () => Promise<void>
  pause: () => Promise<void>
  setCurrentTime: (seconds: number) => Promise<number>
  setPlaybackRate: (rate: number) => Promise<number>
  getTextTracks: () => Promise<Array<{ language: string; kind: string }>>
  enableTextTrack: (language: string, kind?: string) => Promise<unknown>
  disableTextTrack: () => Promise<void>
  on: (event: string, cb: (data: { seconds?: number; playbackRate?: number }) => void) => void
  destroy: () => Promise<void>
}

declare global {
  interface Window {
    Vimeo?: { Player: new (el: HTMLElement, opts: Record<string, unknown>) => VimeoApi }
  }
}

let apiPromise: Promise<void> | null = null
function loadVimeoApi() {
  if (window.Vimeo?.Player) return Promise.resolve()
  apiPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://player.vimeo.com/api/player.js'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      apiPromise = null
      reject(new Error('Không tải được Vimeo player'))
    }
    document.head.appendChild(s)
  })
  return apiPromise
}

const POLL_MS = 40
/** sau seek, bỏ qua timeupdate cũ cho tới khi Vimeo báo `seeked` */
const SEEK_TIMEOUT_MS = 1500
const noop = () => {}

/**
 * Bọc Vimeo player thành giao diện YTPlayer để dùng chung player-store.
 * Vimeo chỉ báo thời gian qua sự kiện `timeupdate` (~4 lần/giây) → nội suy theo đồng hồ
 * để vòng poll dừng đúng cuối câu như YouTube.
 */
function adaptVimeo(p: VimeoApi): YTPlayer {
  let state: number = PLAYER_STATE.CUED
  let rate = 1
  let base = 0
  let baseAt = performance.now()
  let seekingUntil = 0

  const sync = (seconds?: number) => {
    if (seconds === undefined) return
    base = seconds
    baseAt = performance.now()
  }
  const current = () =>
    state === PLAYER_STATE.PLAYING ? base + ((performance.now() - baseAt) / 1000) * rate : base

  p.on('timeupdate', (d) => {
    if (performance.now() < seekingUntil) return
    sync(d.seconds)
    if (state === PLAYER_STATE.BUFFERING) state = PLAYER_STATE.PLAYING
  })
  p.on('seeked', (d) => {
    seekingUntil = 0
    sync(d.seconds)
  })
  p.on('play', (d) => {
    sync(current())
    state = PLAYER_STATE.PLAYING
    if (performance.now() >= seekingUntil) sync(d.seconds)
  })
  p.on('pause', (d) => {
    sync(current())
    state = PLAYER_STATE.PAUSED
    if (performance.now() >= seekingUntil) sync(d.seconds)
  })
  p.on('ended', () => {
    state = PLAYER_STATE.ENDED
  })
  p.on('bufferstart', () => {
    if (state !== PLAYER_STATE.PLAYING) return
    sync(current())
    state = PLAYER_STATE.BUFFERING
  })
  p.on('bufferend', () => {
    if (state !== PLAYER_STATE.BUFFERING) return
    baseAt = performance.now()
    state = PLAYER_STATE.PLAYING
  })
  p.on('playbackratechange', (d) => {
    sync(current())
    if (d.playbackRate) rate = d.playbackRate
  })

  return {
    playVideo: () => void p.play().catch(noop),
    pauseVideo: () => void p.pause().catch(noop),
    seekTo: (seconds) => {
      sync(seconds)
      seekingUntil = performance.now() + SEEK_TIMEOUT_MS
      p.setCurrentTime(seconds).catch(noop)
    },
    getCurrentTime: current,
    getPlayerState: () => state,
    // tài khoản Vimeo không bật đổi tốc độ sẽ từ chối → giữ tốc độ 1
    setPlaybackRate: (r) => {
      p.setPlaybackRate(r)
        .then(() => {
          sync(current())
          rate = r
        })
        .catch(noop)
    },
    getAvailablePlaybackRates: () => [0.5, 0.75, 1, 1.25, 1.5, 2],
    destroy: () => void p.destroy().catch(noop),
  }
}

async function setVimeoCaptions(p: VimeoApi, on: boolean) {
  try {
    if (!on) return await p.disableTextTrack()
    const track = (await p.getTextTracks()).find((t) => t.language.startsWith('en'))
    if (track) await p.enableTextTrack(track.language, track.kind)
  } catch {
    /* player chưa sẵn sàng */
  }
}

interface Props {
  vimeoId: string
  className?: string
  /** chế độ chép chính tả: tắt phụ đề Vimeo và che vùng phụ đề */
  hideCaptions?: boolean
}

export function VimeoPlayer({ vimeoId, className, hideCaptions = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const apiRef = useRef<VimeoApi | null>(null)
  const hideRef = useRef(hideCaptions)
  hideRef.current = hideCaptions
  const [coverOff, setCoverOff] = useState(false)

  const publish = useThrottledCallback(
    (ms: number, playing: boolean) => playerActions.setPlayback(ms, playing),
    { wait: 120, leading: true, trailing: true },
  )

  useEffect(() => {
    let api: VimeoApi | null = null
    let player: YTPlayer | null = null
    let timer: ReturnType<typeof setInterval> | undefined
    let cancelled = false

    loadVimeoApi()
      .then(() => {
        if (cancelled || !hostRef.current || !window.Vimeo) return
        // Vimeo đặt iframe bên trong mount (YouTube thì thay mount) → mount phải phủ kín khung
        const mount = document.createElement('div')
        mount.className = 'size-full'
        hostRef.current.replaceChildren(mount)
        api = new window.Vimeo.Player(mount, {
          id: Number(vimeoId),
          playsinline: true,
          title: false,
          byline: false,
          portrait: false,
          dnt: true,
        })
        player = adaptVimeo(api)
        return api.ready()
      })
      .then(() => {
        if (cancelled || !api || !player) return
        apiRef.current = api
        void setVimeoCaptions(api, !hideRef.current)
        playerActions.attach(player)
        timer = setInterval(() => {
          if (!player) return
          const ms = Math.round(player.getCurrentTime() * 1000)
          const { playing, changed } = playerActions.tick(ms, player.getPlayerState())
          if (changed) playerActions.setPlayback(ms, playing)
          else publish(ms, playing)
        }, POLL_MS)
      })
      .catch((err) => console.error('[vimeo]', err))

    return () => {
      cancelled = true
      clearInterval(timer)
      playerActions.detach()
      apiRef.current = null
      player?.destroy()
    }
  }, [vimeoId, publish])

  useEffect(() => {
    if (apiRef.current) void setVimeoCaptions(apiRef.current, !hideCaptions)
    if (!hideCaptions) setCoverOff(false)
  }, [hideCaptions])

  return (
    <PlayerFrame
      hostRef={hostRef}
      hideCaptions={hideCaptions}
      coverOff={coverOff}
      onToggleCover={() => setCoverOff((v) => !v)}
      className={className}
    />
  )
}
