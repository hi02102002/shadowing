import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { RotateCcw, Scissors, Undo2, X } from 'lucide-react'

import { Button } from '#/components/ui/button'
import { DictationHistory } from '#/components/dictation-panel'
import { PronunciationHistory } from '#/components/pronunciation-panel'
import { formatTime } from '#/lib/format'
import { mergeSegments, splitSegment } from '#/lib/segment-edit'
import { playerActions } from '#/lib/player-store'
import { videoQuery, videosQuery } from '#/lib/queries'
import { editSegments } from '#/server/fns/segment-edits'
import type { SegmentView, VideoDetail } from '#/server/fns/videos'

type Range = { start: number; end: number }

export function SegmentEditor({
  videoId,
  revision,
  segments,
  pastSegments,
  range,
  onRangeChange,
  onClose,
}: {
  videoId: string
  revision: number
  segments: SegmentView[]
  pastSegments: VideoDetail['pastSegments']
  range: Range | null
  onRangeChange: (range: Range | null) => void
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [splitAt, setSplitAt] = useState<number | null>(null)
  useEffect(() => setSplitAt(null), [range?.start, range?.end])
  const selected = range ? segments.slice(range.start, range.end + 1) : []
  const only = selected.length === 1 ? selected[0] : null
  const previewRows = selected.map((seg) => ({
    ...seg,
    startMs: seg.words[0]?.s ?? seg.startMs,
    endMs: seg.words.at(-1)?.e ?? seg.endMs,
    wordsJson: JSON.stringify(seg.words),
  }))
  const merged = selected.length >= 2 ? mergeSegments(previewRows) : null
  const split =
    only && splitAt != null
      ? splitSegment(
          { ...only, wordsJson: JSON.stringify(only.words) },
          splitAt,
        )
      : null

  const edit = useMutation({
    mutationFn: (
      action: Parameters<typeof editSegments>[0]['data']['action'],
    ) =>
      editSegments({
        data: { youtubeId: videoId, expectedRevision: revision, action },
      }),
    onSuccess: async ({ focusIdx }) => {
      playerActions.pause()
      playerActions.clearRange()
      onRangeChange(null)
      setSplitAt(null)
      await queryClient.invalidateQueries({
        queryKey: videoQuery(videoId).queryKey,
      })
      void queryClient.invalidateQueries({ queryKey: videosQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: ['stats'] })
      void queryClient.invalidateQueries({ queryKey: ['dictation-history'] })
      void queryClient.invalidateQueries({ queryKey: ['pronunciation-history'] })
      void queryClient.invalidateQueries({ queryKey: ['mistakes'] })
      void navigate({ to: '.', search: (prev) => ({ ...prev, seg: focusIdx }) })
    },
  })

  return (
    <div className="flex flex-col gap-3 border-b bg-muted/30 p-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <strong>Chỉnh đoạn</strong>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-7"
          onClick={onClose}
          aria-label="Đóng chỉnh đoạn"
        >
          <X className="size-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Chọn một đoạn để tách, hoặc chọn hai đầu của một dải đoạn liền nhau để
        ghép.
      </p>
      {range && (
        <p className="text-xs">
          Đã chọn câu {range.start + 1}–{range.end + 1}{' '}
          <button
            type="button"
            className="ml-2 text-primary underline"
            onClick={() => onRangeChange(null)}
          >
            Bỏ chọn
          </button>
        </p>
      )}
      {merged && (
        <div className="rounded-lg border bg-card p-2">
          <p className="font-medium">
            Sau khi ghép · {formatTime(merged.startMs)}–
            {formatTime(merged.endMs)}
          </p>
          <p className="mt-1 text-xs">{merged.text}</p>
          <Button
            className="mt-2"
            size="sm"
            disabled={edit.isPending}
            onClick={() =>
              edit.mutate({ type: 'merge', ids: selected.map((seg) => seg.id) })
            }
          >
            Ghép {selected.length} đoạn
          </Button>
        </div>
      )}
      {only && (
        <div className="rounded-lg border bg-card p-2">
          <p className="mb-2 font-medium">
            <Scissors className="mr-1 inline size-4" />
            Tách câu {only.idx + 1} giữa hai từ
          </p>
          {only.words.length < 2 ? (
            <p className="text-xs text-muted-foreground">
              Đoạn này không có đủ từ để tách.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-y-2 leading-7">
              {only.words.map((word, index) => (
                <span
                  key={`${index}-${word.s}`}
                  className="inline-flex items-center"
                >
                  <span>{word.w}</span>
                  {index < only.words.length - 1 && (
                    <button
                      type="button"
                      aria-label={`Tách sau từ ${word.w}`}
                      aria-pressed={splitAt === index + 1}
                      onClick={() => setSplitAt(index + 1)}
                      className={`mx-1 rounded px-1.5 text-primary ${splitAt === index + 1 ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/10'}`}
                    >
                      |
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}
          {split && (
            <div className="mt-2 space-y-1 text-xs">
              <p>
                {formatTime(split[0].startMs)}–{formatTime(split[0].endMs)} ·{' '}
                {split[0].text}
              </p>
              <p>
                {formatTime(split[1].startMs)}–{formatTime(split[1].endMs)} ·{' '}
                {split[1].text}
              </p>
            </div>
          )}
          <Button
            className="mt-2"
            size="sm"
            disabled={edit.isPending || !split}
            onClick={() =>
              splitAt != null &&
              edit.mutate({ type: 'split', id: only.id, wordIndex: splitAt })
            }
          >
            Tách đoạn
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={edit.isPending || revision === 0}
          onClick={() => edit.mutate({ type: 'undo' })}
        >
          <Undo2 /> Hoàn tác
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={edit.isPending || revision === 0}
          onClick={() => edit.mutate({ type: 'reset' })}
        >
          <RotateCcw /> Khôi phục bản gốc
        </Button>
      </div>
      {revision > 0 && (
        <p className="text-xs text-muted-foreground">
          Đã chỉnh {revision} lần. Điểm và lịch sử cũ được giữ theo đoạn gốc.
        </p>
      )}
      {pastSegments.length > 0 && (
        <details className="rounded-lg border bg-card p-2">
          <summary className="cursor-pointer font-medium">Lịch sử đoạn cũ ({pastSegments.length})</summary>
          <div className="mt-2 flex flex-col gap-3">
            {pastSegments.map((seg) => <ArchivedHistory key={seg.id} segment={seg} />)}
          </div>
        </details>
      )}
      {edit.error && (
        <p role="alert" className="text-destructive">
          {edit.error.message}
        </p>
      )}
    </div>
  )
}

function ArchivedHistory({ segment }: { segment: VideoDetail['pastSegments'][number] }) {
  const [open, setOpen] = useState(false)
  return (
    <details className="rounded-md border p-2" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary className="cursor-pointer">
        <span className="text-xs text-muted-foreground">{formatTime(segment.startMs)}–{formatTime(segment.endMs)}</span>
        <span className="block">{segment.text}</span>
        <span className="text-xs text-muted-foreground">{segment.dictationBest == null ? '' : `Chép ${Math.round(segment.dictationBest)} · `}{segment.pronunciationBest == null ? '' : `Nói ${Math.round(segment.pronunciationBest)}`}</span>
      </summary>
      {open && <div className="mt-2 space-y-2"><DictationHistory segmentId={segment.id} /><PronunciationHistory segmentId={segment.id} /></div>}
    </details>
  )
}
