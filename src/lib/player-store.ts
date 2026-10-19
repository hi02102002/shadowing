import { createStore } from '@tanstack/react-store'

/** Giao diện tối thiểu của YT.Player mà app dùng */
export interface YTPlayer {
  playVideo: () => void
  pauseVideo: () => void
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  getCurrentTime: () => number
  getPlayerState: () => number
  setPlaybackRate: (rate: number) => void
  getAvailablePlaybackRates: () => number[]
  destroy: () => void
  /** API không chính thức nhưng ổn định: tắt module phụ đề ('captions' / 'cc') */
  unloadModule?: (name: string) => void
  loadModule?: (name: string) => void
}

export const PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export const RATES = [0.5, 0.75, 0.9, 1, 1.25] as const

interface PlayerState {
  ready: boolean
  playing: boolean
  currentMs: number
  rate: number
  /** lặp lại câu hiện tại */
  loop: boolean
  /** khoảng đang phát (để tự dừng/lặp ở cuối câu) */
  range: { startMs: number; endMs: number } | null
  /** số lần đã phát hết range kể từ lần playRange gần nhất */
  plays: number
  /** đoạn ngắn (một từ / cụm từ) đang phát; ưu tiên hơn range và không tính vào plays */
  clip: { startMs: number; endMs: number } | null
}

const initial: PlayerState = {
  ready: false,
  playing: false,
  currentMs: 0,
  rate: 1,
  loop: false,
  range: null,
  plays: 0,
  clip: null,
}

let yt: YTPlayer | null = null
/** dừng sớm hơn endMs một chút vì getCurrentTime() được poll ~40ms/lần */
const END_PAD_MS = 120
/** lùi điểm bắt đầu một chút để không mất phụ âm đầu */
const START_PAD_MS = 80
/** timing từng từ trong phụ đề thường lệch ±100ms → mở rộng clip để không cụt âm */
const CLIP_LEAD_MS = 150
const CLIP_TAIL_MS = 250
/**
 * Sau seekTo, getCurrentTime() của YouTube vẫn trả vị trí CŨ thêm vài trăm ms.
 * Nếu vị trí cũ nằm sau điểm kết thúc câu/clip, vòng poll sẽ tưởng đã phát xong và pause ngay
 * → bấm play "không chạy". Vì vậy bỏ qua kiểm tra kết thúc cho tới khi thời gian báo về đã tới gần
 * điểm seek (hoặc quá SEEK_SETTLE_TIMEOUT_MS).
 */
const SEEK_TOLERANCE_MS = 600
const SEEK_SETTLE_TIMEOUT_MS = 2000
let pendingSeek: { ms: number; at: number } | null = null

function seekTo(ms: number) {
  const target = Math.max(0, ms)
  pendingSeek = { ms: target, at: Date.now() }
  yt?.seekTo(target / 1000, true)
}

/** true khi vị trí báo về đã phản ánh lần seek gần nhất */
function seekSettled(currentMs: number) {
  if (!pendingSeek) return true
  const near =
    currentMs >= pendingSeek.ms - SEEK_TOLERANCE_MS &&
    currentMs <= pendingSeek.ms + SEEK_TOLERANCE_MS * 3
  if (near || Date.now() - pendingSeek.at > SEEK_SETTLE_TIMEOUT_MS) {
    pendingSeek = null
    return true
  }
  return false
}

export const playerStore = createStore(initial, ({ setState, get }) => ({
  attach(player: YTPlayer) {
    yt = player
    player.setPlaybackRate(get().rate)
    setState((s) => ({ ...s, ready: true }))
  },
  detach() {
    yt = null
    pendingSeek = null
    setState(() => initial)
  },
  /** phát một đoạn [startMs, endMs] rồi tự dừng (hoặc lặp nếu loop) */
  playRange(startMs: number, endMs: number) {
    if (!yt) return
    seekTo(startMs - START_PAD_MS)
    yt.playVideo()
    setState((s) => ({ ...s, range: { startMs, endMs }, plays: 0, clip: null }))
  },
  /** phát lại một từ / cụm từ rồi dừng, giữ nguyên range của câu đang luyện */
  playClip(startMs: number, endMs: number) {
    if (!yt) return
    const clip = {
      startMs: Math.max(0, startMs - CLIP_LEAD_MS),
      endMs: endMs + CLIP_TAIL_MS,
    }
    seekTo(clip.startMs)
    yt.playVideo()
    setState((s) => ({ ...s, clip }))
  },
  play() {
    yt?.playVideo()
  },
  pause() {
    yt?.pauseVideo()
  },
  toggle() {
    if (!yt) return
    if (get().playing) {
      yt.pauseVideo()
      return
    }
    setState((s) => ({ ...s, clip: null }))
    const { range, currentMs } = get()
    // đang đứng ở cuối câu → phát lại từ đầu câu
    if (range && currentMs >= range.endMs - END_PAD_MS * 2) {
      seekTo(range.startMs - START_PAD_MS)
    }
    yt.playVideo()
  },
  seek(ms: number) {
    seekTo(ms)
    setState((s) => ({ ...s, currentMs: ms }))
  },
  /** xem video tự do (chế độ transcript) — bỏ giới hạn range */
  clearRange() {
    setState((s) => ({ ...s, range: null }))
  },
  setRate(rate: number) {
    yt?.setPlaybackRate(rate)
    setState((s) => ({ ...s, rate }))
  },
  setLoop(loop: boolean) {
    setState((s) => ({ ...s, loop }))
  },
  /** gọi từ vòng poll của player */
  tick(currentMs: number, ytState: number) {
    const s = get()
    const playing =
      ytState === PLAYER_STATE.PLAYING || ytState === PLAYER_STATE.BUFFERING
    // vị trí còn là của trước lần seek → chưa được kết luận "đã phát hết"
    if (!seekSettled(currentMs))
      return { playing, changed: s.playing !== playing }
    if (s.clip) {
      if (playing && currentMs >= s.clip.endMs) {
        yt?.pauseVideo()
        setState((p) => ({ ...p, clip: null }))
      }
      return { playing, changed: s.playing !== playing }
    }
    if (s.range && playing && currentMs >= s.range.endMs - END_PAD_MS) {
      if (s.loop) {
        seekTo(s.range.startMs - START_PAD_MS)
      } else {
        yt?.pauseVideo()
      }
      setState((p) => ({ ...p, plays: p.plays + 1 }))
    }
    return { playing, changed: s.playing !== playing }
  },
  setPlayback(currentMs: number, playing: boolean) {
    setState((s) => ({ ...s, currentMs, playing }))
  },
}))

export const playerActions = playerStore.actions

/** Mảng segments đã sắp xếp theo startMs → tìm câu chứa thời điểm t */
export function findSegmentIndex(
  segs: ReadonlyArray<{ startMs: number; endMs: number }>,
  t: number,
) {
  let lo = 0
  let hi = segs.length - 1
  let ans = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (segs[mid].startMs <= t) {
      ans = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  return ans
}
