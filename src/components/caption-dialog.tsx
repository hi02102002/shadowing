import { useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Cpu, Loader2, ReceiptText } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Progress } from '#/components/ui/progress'
import type { CaptionEstimate } from '#/server/captions'
import { cancelCaptionJob, captionJobStatus } from '#/server/fns/captions'
import type { JobView } from '#/server/jobs'

export type CaptionDialogState =
  | {
      step: 'confirm'
      title: string
      durationSec: number
      estimate: CaptionEstimate
    }
  | { step: 'job'; title: string; jobId: string }

interface Props {
  state: CaptionDialogState | null
  /** đang gửi yêu cầu tạo job */
  confirming: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
  onDone: (youtubeId: string) => void
}

/** Video/file không có phụ đề: hỏi trước khi tạo bằng Whisper, rồi hiện tiến độ job */
export function CaptionDialog({ state, confirming, error, onConfirm, onCancel, onDone }: Props) {
  return (
    <Dialog open={state !== null} onOpenChange={(open) => !open && state?.step === 'confirm' && onCancel()}>
      {state && (
        <DialogContent
          showCloseButton={state.step === 'confirm'}
          // job đang chạy: chỉ đóng bằng nút Huỷ để không bỏ quên tiến trình nền
          onInteractOutside={(e) => state.step === 'job' && e.preventDefault()}
          onEscapeKeyDown={(e) => state.step === 'job' && e.preventDefault()}
        >
          {state.step === 'confirm' ? (
            <ConfirmStep
              state={state}
              confirming={confirming}
              error={error}
              onConfirm={onConfirm}
              onCancel={onCancel}
            />
          ) : (
            <JobStep state={state} onCancel={onCancel} onDone={onDone} />
          )}
        </DialogContent>
      )}
    </Dialog>
  )
}

const mb = (bytes: number) => `${Math.round(bytes / 1024 ** 2)} MB`

function eta(sec: number) {
  if (sec < 60) return 'dưới 1 phút'
  return `khoảng ${Math.round(sec / 60)} phút`
}

function ConfirmStep({
  state,
  confirming,
  error,
  onConfirm,
  onCancel,
}: {
  state: Extract<CaptionDialogState, { step: 'confirm' }>
  confirming: boolean
  error: string | null
  onConfirm: () => void
  onCancel: () => void
}) {
  const { estimate } = state
  return (
    <>
      <DialogHeader>
        <DialogTitle>Video chưa có phụ đề</DialogTitle>
        <DialogDescription className="line-clamp-2">{state.title}</DialogDescription>
      </DialogHeader>

      {estimate.engine === 'local' ? (
        <div className="flex gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <Cpu className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <p>
              Tạo phụ đề ngay trên máy bằng <b>whisper.cpp</b> (model {estimate.model}). Miễn phí, audio không rời khỏi
              máy.
            </p>
            <p className="text-muted-foreground">
              {estimate.minutes} phút audio · mất {eta(estimate.etaSec)}
              {estimate.downloadBytes > 0 && <> · cần tải model {mb(estimate.downloadBytes)} lần đầu</>}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex gap-3 rounded-lg border bg-muted/40 p-3 text-sm">
          <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" />
          <div className="flex flex-col gap-1">
            <p>
              Tạo phụ đề bằng <b>{estimate.model}</b> qua API. Audio sẽ được gửi tới <b>{estimate.provider}</b>.
            </p>
            <p className="text-muted-foreground">
              {estimate.minutes} phút audio ·{' '}
              {estimate.usd === null ? (
                'không rõ giá của model này'
              ) : estimate.usd === 0 ? (
                'miễn phí (server tự host)'
              ) : (
                <>
                  ước tính <b className="text-foreground">${estimate.usd.toFixed(estimate.usd < 0.1 ? 3 : 2)}</b>
                </>
              )}
            </p>
          </div>
        </div>
      )}

      {estimate.unavailable && (
        <p className="flex gap-2 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            {estimate.unavailable}{' '}
            <Link to="/settings" className="underline">
              Mở Cài đặt
            </Link>
          </span>
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={confirming}>
          Huỷ
        </Button>
        <Button onClick={onConfirm} disabled={confirming || !!estimate.unavailable}>
          {confirming && <Loader2 className="animate-spin" />}
          Tạo phụ đề
        </Button>
      </DialogFooter>
    </>
  )
}

const STAGE_LABEL: Record<NonNullable<JobView['stage']>, string> = {
  'downloading-audio': 'Đang tải audio của video…',
  'downloading-model': 'Đang tải model Whisper (chỉ lần đầu)…',
  preparing: 'Đang chuẩn bị audio…',
  transcribing: 'Đang nhận dạng lời nói…',
}

function JobStep({
  state,
  onCancel,
  onDone,
}: {
  state: Extract<CaptionDialogState, { step: 'job' }>
  onCancel: () => void
  onDone: (youtubeId: string) => void
}) {
  const { data: job, error } = useQuery({
    queryKey: ['caption-job', state.jobId],
    queryFn: () => captionJobStatus({ data: { jobId: state.jobId } }),
    refetchInterval: (q) => (q.state.data && !['queued', 'running'].includes(q.state.data.status) ? false : 1000),
  })
  const cancel = useMutation({
    mutationFn: () => cancelCaptionJob({ data: { jobId: state.jobId } }),
    onSettled: onCancel,
  })

  useEffect(() => {
    if (job?.status === 'done' && job.youtubeId) onDone(job.youtubeId)
  }, [job?.status, job?.youtubeId, onDone])

  const failed = job?.status === 'error' || job?.status === 'cancelled' || !!error
  const pct = Math.round((job?.progress ?? 0) * 100)
  // các giai đoạn không đo được tiến độ: hiện thanh chạy liên tục thay vì đứng ở 0%
  const indeterminate = !job?.stage || job.stage === 'downloading-audio' || job.stage === 'preparing'

  return (
    <>
      <DialogHeader>
        <DialogTitle>Đang tạo phụ đề</DialogTitle>
        <DialogDescription className="line-clamp-2">{state.title}</DialogDescription>
      </DialogHeader>

      {failed ? (
        <p className="text-sm text-destructive">{error?.message ?? job?.error ?? 'Đã huỷ tạo phụ đề.'}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span>
              {job?.status === 'queued'
                ? 'Đang chờ video khác tạo xong…'
                : job?.stage
                  ? STAGE_LABEL[job.stage]
                  : 'Đang bắt đầu…'}
            </span>
            {!indeterminate && <span className="font-mono text-xs text-muted-foreground">{pct}%</span>}
          </div>
          <Progress value={indeterminate ? 100 : pct} className={indeterminate ? 'animate-pulse' : undefined} />
          <p className="text-xs text-muted-foreground">Có thể đóng tab: tiến trình vẫn chạy, video sẽ có trong thư viện khi xong.</p>
        </div>
      )}

      <DialogFooter>
        {failed ? (
          <Button variant="outline" onClick={onCancel}>
            Đóng
          </Button>
        ) : (
          <Button variant="outline" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
            Huỷ
          </Button>
        )}
      </DialogFooter>
    </>
  )
}
