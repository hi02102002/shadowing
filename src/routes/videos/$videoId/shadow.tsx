import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { EyeOff } from 'lucide-react'

import { KaraokeText } from '#/components/karaoke-text'
import { PronunciationPanel } from '#/components/pronunciation-panel'
import { SegmentControls } from '#/components/segment-controls'
import { Label } from '#/components/ui/label'
import { Switch } from '#/components/ui/switch'
import { usePracticeSegment } from '#/hooks/use-practice-segment'

export const Route = createFileRoute('/videos/$videoId/shadow')({
  component: ShadowMode,
})

function ShadowMode() {
  const { videoId, segment, idx, total, go } = usePracticeSegment()
  const [blind, setBlind] = useState(false)

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

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Câu {idx + 1}</span>
          <div className="flex items-center gap-2">
            <Switch id="blind" checked={blind} onCheckedChange={setBlind} />
            <Label htmlFor="blind" className="flex items-center gap-1 text-sm text-muted-foreground">
              <EyeOff className="size-3.5" /> Shadow không nhìn chữ
            </Label>
          </div>
        </div>
        <KaraokeText segment={segment} hidden={blind} />
        <p className="text-xs text-muted-foreground">
          Mẹo: nghe 2–3 lần với tốc độ 0.75×, rồi bật <b>Lặp</b> và nói đuổi theo, chậm hơn người nói khoảng nửa giây. Khi đã
          quen thì ghi âm để chấm điểm.
        </p>
      </div>

      <PronunciationPanel youtubeId={videoId} segment={segment} mode="shadow" />
    </div>
  )
}
