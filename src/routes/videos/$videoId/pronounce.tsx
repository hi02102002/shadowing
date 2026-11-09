import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'

import { KaraokeText, OptionToggle } from '#/components/karaoke-text'
import { PronunciationPanel } from '#/components/pronunciation-panel'
import { SegmentControls } from '#/components/segment-controls'
import { VideoSubmissionBar } from '#/components/video-submission-bar'
import { usePracticeSegment } from '#/hooks/use-practice-segment'
import { useStoredToggle } from '#/hooks/use-stored-toggle'
import { videoQuery } from '#/lib/queries'

export const Route = createFileRoute('/videos/$videoId/pronounce')({
  component: PronounceMode,
})

function PronounceMode() {
  const { videoId, segment, idx, total, go } = usePracticeSegment()
  const { data } = useSuspenseQuery(videoQuery(videoId))
  const [showIpa, setShowIpa] = useStoredToggle('show-ipa')
  const [showVi, setShowVi] = useStoredToggle('show-translation')

  return (
    <div className="flex flex-col gap-4">
      {/* Thanh công cụ quay bài nộp phát âm */}
      <VideoSubmissionBar
        videoTitle={data.video.title}
        segments={data.segments}
        currentIdx={idx}
        onSelectSegment={go}
        mode="repeat"
      />

      <SegmentControls
        index={idx}
        total={total}
        startMs={segment.startMs}
        endMs={segment.endMs}
        onPrev={() => go(idx - 1)}
        onNext={() => go(idx + 1)}
      />
      <div className="rounded-xl border bg-card p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Câu {idx + 1}: đọc to câu này
          </span>
          <div className="flex items-center gap-4">
            <OptionToggle label="IPA" checked={showIpa} onChange={setShowIpa} />
            <OptionToggle label="Dịch" checked={showVi} onChange={setShowVi} />
          </div>
        </div>
        <KaraokeText segment={segment} ipa={showIpa} translate={showVi} />
      </div>
      <PronunciationPanel key={`${segment.id}:${segment.text}:${segment.startMs}:${segment.endMs}`} youtubeId={videoId} segment={segment} mode="repeat" />
    </div>
  )
}
