import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { EyeOff } from 'lucide-react'

import { KaraokeText, OptionToggle } from '#/components/karaoke-text'
import { ShadowingGuide } from '#/components/pillar-summary'
import { PronunciationPanel } from '#/components/pronunciation-panel'
import { SegmentControls } from '#/components/segment-controls'
import { VideoSubmissionBar } from '#/components/video-submission-bar'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { usePracticeSegment } from '#/hooks/use-practice-segment'
import { useStoredToggle } from '#/hooks/use-stored-toggle'
import { videoQuery } from '#/lib/queries'

export const Route = createFileRoute('/videos/$videoId/shadow')({
  component: ShadowMode,
})

function ShadowMode() {
  const { videoId, segment, idx, total, go } = usePracticeSegment()
  const { data } = useSuspenseQuery(videoQuery(videoId))

  const [blind, setBlind] = useState(false)
  const [showIpa, setShowIpa] = useStoredToggle('show-ipa')
  const [showVi, setShowVi] = useStoredToggle('show-translation')

  return (
    <div className="flex flex-col gap-4">
      {/* Thanh công cụ quay bài nộp cô giáo */}
      <VideoSubmissionBar
        videoTitle={data.video.title}
        segments={data.segments}
        currentIdx={idx}
        onSelectSegment={go}
        mode="shadow"
      />

      <ShadowingGuide />

      <SegmentControls
        index={idx}
        total={total}
        startMs={segment.startMs}
        endMs={segment.endMs}
        onPrev={() => go(idx - 1)}
        onNext={() => go(idx + 1)}
      />

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Câu {idx + 1}
          </span>
          <div className="flex items-center gap-4">
            <OptionToggle label="IPA" checked={showIpa} onChange={setShowIpa} />
            <OptionToggle label="Dịch" checked={showVi} onChange={setShowVi} />
            <div className="flex items-center gap-2">
              <Switch id="blind" checked={blind} onCheckedChange={setBlind} />
              <Label htmlFor="blind" className="flex items-center gap-1 text-sm text-muted-foreground">
                <EyeOff className="size-3.5" /> Shadow không nhìn chữ
              </Label>
            </div>
          </div>
        </div>
        <KaraokeText segment={segment} hidden={blind} ipa={showIpa} translate={showVi} />
        <p className="text-xs text-muted-foreground">
          Mẹo: nghe 2–3 lần với tốc độ 0.75×, rồi bật <b>Lặp</b> và nói đuổi theo, chậm hơn người nói khoảng nửa giây. Khi đã
          quen thì ghi âm để chấm điểm hoặc bấm <b>Quay bài nộp</b> để quay video nộp cho cô.
        </p>
      </div>

      <PronunciationPanel
        key={`${segment.id}:${segment.text}:${segment.startMs}:${segment.endMs}`}
        youtubeId={videoId}
        segment={segment}
        mode="shadow"
      />
    </div>
  )
}
