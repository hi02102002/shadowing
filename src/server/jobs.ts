/**
 * Job tạo phụ đề chạy nền (có thể mất vài phút): client nhận jobId rồi hỏi tiến độ định kỳ.
 * Lưu trong bộ nhớ, chạy lần lượt từng job vì whisper.cpp đã dùng gần hết CPU.
 */
import { randomUUID } from 'node:crypto'

import type { CaptionProgress } from './captions.ts'

export type JobStatus = 'queued' | 'running' | 'done' | 'error' | 'cancelled'

interface Job {
  id: string
  title: string
  status: JobStatus
  stage: CaptionProgress['stage'] | null
  progress: number
  youtubeId: string | null
  error: string | null
  abort: AbortController
}

export type JobView = Omit<Job, 'abort'>

export interface JobContext {
  signal: AbortSignal
  report: (p: CaptionProgress) => void
}

/** giữ job đã xong thêm một lúc để client kịp đọc kết quả */
const KEEP_MS = 10 * 60_000

const jobs = new Map<string, Job>()
let tail: Promise<unknown> = Promise.resolve()

export function startJob(
  title: string,
  run: (ctx: JobContext) => Promise<{ youtubeId: string }>,
  onSettled?: () => Promise<void> | void,
): string {
  const job: Job = {
    id: randomUUID(),
    title,
    status: 'queued',
    stage: null,
    progress: 0,
    youtubeId: null,
    error: null,
    abort: new AbortController(),
  }
  jobs.set(job.id, job)

  tail = tail.then(async () => {
    try {
      if (job.abort.signal.aborted) return
      job.status = 'running'
      const res = await run({
        signal: job.abort.signal,
        report: (p) => {
          job.stage = p.stage
          job.progress = p.progress
        },
      })
      job.youtubeId = res.youtubeId
      job.status = 'done'
    } catch (err) {
      if (job.abort.signal.aborted) job.status = 'cancelled'
      else {
        job.status = 'error'
        job.error = err instanceof Error ? err.message : String(err)
        console.error('[caption-job]', err)
      }
    } finally {
      await Promise.resolve(onSettled?.()).catch((err) => console.error('[caption-job] cleanup', err))
      setTimeout(() => jobs.delete(job.id), KEEP_MS).unref()
    }
  })
  return job.id
}

export function getJob(id: string): JobView | null {
  const job = jobs.get(id)
  if (!job) return null
  const { abort: _abort, ...view } = job
  return view
}

export function cancelJob(id: string) {
  const job = jobs.get(id)
  if (!job || job.status === 'done' || job.status === 'error') return
  job.abort.abort()
  if (job.status === 'queued') job.status = 'cancelled'
}
