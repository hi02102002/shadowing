import { useCallback, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { CaptionDialog } from '#/components/caption-dialog'
import type { CaptionDialogState } from '#/components/caption-dialog'
import type { LocalImportPending } from '#/components/local-import-dialog'
import { videosQuery } from '#/lib/queries'
import { discardUpload, importLocal, importVideo } from '#/server/fns/videos'
import type { ImportResult } from '#/server/fns/videos'

type PendingImport = { kind: 'url'; url: string } | LocalImportPending

/**
 * Import video từ link (YouTube/elllo) hoặc file máy, hỏi tạo phụ đề khi thiếu,
 * xong thì mở trang học. Render `dialog` ở đâu đó trong component (ngoài <form>).
 */
export function useVideoImport() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<CaptionDialogState | null>(null)
  const [pending, setPending] = useState<PendingImport | null>(null)

  const openVideo = useCallback(
    async (youtubeId: string) => {
      setDialog(null)
      setPending(null)
      await queryClient.invalidateQueries({ queryKey: videosQuery().queryKey })
      // danh sách Khám phá đánh dấu bài "Đã có"
      void queryClient.invalidateQueries({ queryKey: ['catalog'] })
      await navigate({ to: '/videos/$videoId', params: { videoId: youtubeId } })
    },
    [navigate, queryClient],
  )

  const handleResult = (res: ImportResult, from: PendingImport) => {
    if (res.status === 'ready') return void openVideo(res.youtubeId)
    setPending(from)
    setDialog(
      res.status === 'needs-captions'
        ? {
            step: 'confirm',
            title: res.title,
            durationSec: res.durationSec,
            estimate: res.estimate,
          }
        : {
            step: 'job',
            title: from.kind === 'local' ? from.title : 'Video',
            jobId: res.jobId,
          },
    )
  }

  const mutation = useMutation({
    mutationFn: (url: string) => importVideo({ data: { url } }),
    onSuccess: (res, url) => handleResult(res, { kind: 'url', url }),
  })

  // người dùng đồng ý tạo phụ đề → gọi lại import với generateCaptions
  const confirm = useMutation({
    mutationFn: (p: PendingImport) =>
      p.kind === 'url'
        ? importVideo({ data: { url: p.url, generateCaptions: true } })
        : importLocal({
            data: {
              uploadId: p.uploadId,
              title: p.title,
              generateCaptions: true,
            },
          }),
    onSuccess: (res, p) => {
      if (res.status === 'job')
        setDialog({
          step: 'job',
          title: dialog?.title ?? 'Video',
          jobId: res.jobId,
        })
      else handleResult(res, p)
    },
  })

  const cancel = () => {
    // bỏ qua ở bước xác nhận: file đã upload không dùng nữa (job tự dọn file của nó)
    if (dialog?.step === 'confirm' && pending?.kind === 'local') {
      void discardUpload({ data: { uploadId: pending.uploadId } })
    }
    confirm.reset()
    setDialog(null)
    setPending(null)
  }

  return {
    importUrl: mutation.mutate,
    /** link đang import (chờ server trả kết quả) */
    importing: mutation.isPending ? mutation.variables : null,
    error: mutation.error,
    handleResult,
    dialog: (
      <CaptionDialog
        state={dialog}
        confirming={confirm.isPending}
        error={confirm.error?.message ?? null}
        onConfirm={() => pending && confirm.mutate(pending)}
        onCancel={cancel}
        onDone={openVideo}
      />
    ),
  }
}
