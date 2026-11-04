import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { LessonChunks } from '#/components/lesson-chunks'
import { playerActions } from '#/lib/player-store'
import { videoQuery } from '#/lib/queries'

export const Route = createFileRoute('/videos/$videoId/chunks')({
  component: ChunksMode,
})

const videoRoute = getRouteApi('/videos/$videoId')

/** chunk của kho xuất hiện trong phụ đề; bấm vào chunk để nghe đúng câu trong video */
function ChunksMode() {
  const { videoId } = videoRoute.useParams()
  const { data } = useSuspenseQuery(videoQuery(videoId))
  const segments = data.segments
  const play = (surface: string) => {
    const needle = surface.toLowerCase()
    const seg = segments.find((s) => s.text.toLowerCase().includes(needle))
    if (seg) playerActions.playRange(seg.startMs, seg.endMs)
  }
  return (
    <LessonChunks
      text={segments.map((s) => s.text).join('\n')}
      onLocate={play}
      empty="Video chưa có phụ đề."
    />
  )
}
