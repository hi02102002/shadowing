import { createFileRoute } from '@tanstack/react-router'

import { KaraokeText } from '#/components/karaoke-text'
import { PronunciationPanel } from '#/components/pronunciation-panel'
import { SegmentControls } from '#/components/segment-controls'
import { usePracticeSegment } from '#/hooks/use-practice-segment'

export const Route = createFileRoute('/videos/$videoId/pronounce')({
  component: PronounceMode,
})

function PronounceMode() {
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
      <div className="rounded-xl border bg-card p-5">
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Câu {idx + 1}: đọc to câu này
        </span>
        <KaraokeText segment={segment} />
      </div>
      <PronunciationPanel youtubeId={videoId} segment={segment} mode="repeat" />
    </div>
  )
}
