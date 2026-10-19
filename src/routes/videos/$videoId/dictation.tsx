import { createFileRoute } from '@tanstack/react-router'

import { DictationPanel } from '#/components/dictation-panel'
import { SegmentControls } from '#/components/segment-controls'
import { usePracticeSegment } from '#/hooks/use-practice-segment'

export const Route = createFileRoute('/videos/$videoId/dictation')({
  component: DictationMode,
})

function DictationMode() {
  const { videoId, segment, idx, total, go } = usePracticeSegment()

  return (
    <div className="flex flex-col gap-4">
      <SegmentControls
        index={idx}
        total={total}
        startMs={segment.startMs}
        endMs={segment.endMs}
        onPrev={() => go(idx - 1)}
        onNext={() => go(idx + 1)}
      />
      <DictationPanel youtubeId={videoId} segment={segment} hasNext={idx < total - 1} onNext={() => go(idx + 1)} />
    </div>
  )
}
