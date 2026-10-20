import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { cancelJob, getJob } from '../jobs.ts'
import { ensureModel, whisperLocalStatus } from '../whisper-local.ts'

export const captionJobStatus = createServerFn({ method: 'GET' })
  .validator(z.object({ jobId: z.string() }))
  .handler(async ({ data }) => {
    const job = getJob(data.jobId)
    if (!job) throw new Error('Không tìm thấy tiến trình tạo phụ đề (có thể server đã khởi động lại)')
    return job
  })

export const cancelCaptionJob = createServerFn({ method: 'POST' })
  .validator(z.object({ jobId: z.string() }))
  .handler(async ({ data }) => {
    cancelJob(data.jobId)
    return { ok: true }
  })

export const whisperStatus = createServerFn({ method: 'GET' }).handler(async () => whisperLocalStatus())

export type WhisperStatus = Awaited<ReturnType<typeof whisperStatus>>

/** Bắt đầu tải model ở nền rồi trả về ngay; trang Cài đặt hỏi tiến độ bằng whisperStatus */
export const downloadWhisperModel = createServerFn({ method: 'POST' }).handler(async () => {
  ensureModel().catch(() => {
    /* lỗi được ghi vào whisperLocalStatus().error */
  })
  return whisperLocalStatus()
})
