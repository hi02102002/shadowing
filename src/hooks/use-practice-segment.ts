import { useEffect } from 'react'
import { getRouteApi, useNavigate } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useHotkey } from '@tanstack/react-hotkeys'

import { playerActions, playerStore } from '#/lib/player-store'
import { videoQuery } from '#/lib/queries'

const videoRoute = getRouteApi('/videos/$videoId')

/**
 * Câu đang luyện (theo search param `seg`), hàm điều hướng và phím tắt dùng chung
 * cho các chế độ shadow / dictation / pronounce.
 */
export function usePracticeSegment() {
  const { videoId } = videoRoute.useParams()
  const { seg } = videoRoute.useSearch()
  const { data } = useSuspenseQuery(videoQuery(videoId))
  const navigate = useNavigate()

  const total = data.segments.length
  const idx = Math.min(Math.max(seg ?? 0, 0), total - 1)
  const segment = data.segments[idx]

  const go = (i: number) => {
    const next = Math.min(Math.max(i, 0), total - 1)
    if (next !== idx) void navigate({ to: '.', search: (p) => ({ ...p, seg: next }) })
  }

  const replay = () => playerActions.playRange(segment.startMs, segment.endMs)

  // đặt range cho câu hiện tại để Space/R hoạt động ngay cả khi chưa bấm nghe
  useEffect(() => {
    if (playerStore.state.range?.startMs !== segment.startMs) {
      playerActions.pause()
      playerStore.setState((s) => ({ ...s, range: { startMs: segment.startMs, endMs: segment.endMs }, plays: 0 }))
      if (playerStore.state.ready) playerActions.seek(Math.max(0, segment.startMs - 80))
    }
  }, [segment.startMs, segment.endMs])

  const opts = { ignoreInputs: true, preventDefault: true } as const
  useHotkey('Space', () => playerActions.toggle(), opts)
  useHotkey('R', replay, opts)
  useHotkey('ArrowLeft', () => go(idx - 1), opts)
  useHotkey('ArrowRight', () => go(idx + 1), opts)
  useHotkey('L', () => playerActions.setLoop(!playerStore.state.loop), opts)

  return { videoId, video: data.video, segments: data.segments, segment, idx, total, go, replay }
}
