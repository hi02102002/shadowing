import { beforeEach, describe, expect, it } from 'vitest'

import { PLAYER_STATE, playerActions, playerStore } from './player-store.ts'
import type { YTPlayer } from './player-store.ts'

/**
 * Player giả: giống YouTube, sau seekTo thì getCurrentTime() còn trả vị trí cũ
 * thêm `staleTicks` lần poll rồi mới nhảy tới vị trí mới.
 */
function fakePlayer(staleTicks = 3) {
  let time = 0
  let target: number | null = null
  let staleLeft = 0
  let state: number = PLAYER_STATE.PAUSED
  const calls: string[] = []
  const player: YTPlayer = {
    playVideo: () => {
      calls.push('play')
      state = PLAYER_STATE.PLAYING
    },
    pauseVideo: () => {
      calls.push('pause')
      state = PLAYER_STATE.PAUSED
    },
    seekTo: (sec) => {
      target = sec
      staleLeft = staleTicks
    },
    getCurrentTime: () => time,
    getPlayerState: () => state,
    setPlaybackRate: () => {},
    getAvailablePlaybackRates: () => [1],
    destroy: () => {},
  }
  /** một vòng poll: thời gian trôi 40ms nếu đang phát, áp dụng seek sau khi hết "stale" */
  const poll = () => {
    if (target !== null) {
      if (staleLeft-- <= 0) {
        time = target
        target = null
      }
    } else if (state === PLAYER_STATE.PLAYING) {
      time += 0.04
    }
    playerActions.tick(Math.round(time * 1000), state)
  }
  const setTime = (sec: number) => {
    time = sec
  }
  return {
    player,
    poll,
    calls,
    setTime,
    isPlaying: () => state === PLAYER_STATE.PLAYING,
  }
}

describe('player store: play ngay sau seek', () => {
  beforeEach(() => playerActions.detach())

  it('phát lại câu vừa nghe xong: không bị pause vì vị trí cũ ở cuối câu', () => {
    const f = fakePlayer()
    playerActions.attach(f.player)
    // đã nghe xong câu 1000–3000ms, đang đứng ở cuối câu
    f.setTime(2.95)
    playerActions.playRange(1000, 3000)
    for (let i = 0; i < 6; i++) f.poll()
    expect(f.isPlaying()).toBe(true)
    expect(f.calls).not.toContain('pause')
  })

  it('click một từ nằm trước vị trí hiện tại: clip vẫn phát', () => {
    const f = fakePlayer()
    playerActions.attach(f.player)
    f.setTime(10)
    playerActions.playClip(2000, 2400)
    for (let i = 0; i < 6; i++) f.poll()
    expect(f.isPlaying()).toBe(true)
    expect(playerStore.state.clip).not.toBeNull()
  })

  it('vẫn tự dừng ở cuối câu sau khi seek đã ổn định', () => {
    const f = fakePlayer()
    playerActions.attach(f.player)
    playerActions.playRange(1000, 1400)
    for (let i = 0; i < 30 && f.isPlaying(); i++) f.poll()
    expect(f.isPlaying()).toBe(false)
    expect(playerStore.state.plays).toBe(1)
  })

  it('clip tự dừng và không làm tăng plays của câu', () => {
    const f = fakePlayer()
    playerActions.attach(f.player)
    playerActions.playRange(1000, 5000)
    playerActions.playClip(2000, 2100)
    for (let i = 0; i < 40 && f.isPlaying(); i++) f.poll()
    expect(f.isPlaying()).toBe(false)
    expect(playerStore.state.clip).toBeNull()
    expect(playerStore.state.plays).toBe(0)
  })
})
