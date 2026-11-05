/**
 * Xuất bộ thẻ ra .apkg: server tự tạo ảnh/audio nên chạy nền; ở đây bắt đầu, hỏi tiến độ rồi cho trình duyệt tải file.
 * `target` là id bộ thẻ hoặc `book?name=<tên sách>`.
 */
export async function downloadApkg(
  target: string,
  onProgress?: (done: number, total: number) => void,
) {
  const sep = target.includes('?') ? '&' : '?'
  const res = await fetch(`/api/deck-export/${target}${sep}start=1`)
  const started = (await res.json().catch(() => null)) as {
    jobId?: string
    total?: number
    error?: string
  } | null
  if (!res.ok || !started?.jobId)
    throw new Error(started?.error || 'Không bắt đầu được việc xuất file')
  onProgress?.(0, started.total ?? 0)
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000))
    const poll = await fetch(
      `/api/deck-export/${target}${sep}jobId=${started.jobId}`,
    )
    const job = (await poll.json().catch(() => null)) as {
      status?: string
      processed?: number
      total?: number
      error?: string
    } | null
    if (!poll.ok || !job) throw new Error(job?.error || 'Mất tác vụ xuất file')
    if (job.status === 'error')
      throw new Error(job.error || 'Xuất file thất bại')
    if (job.status === 'completed') break
    onProgress?.(job.processed ?? 0, job.total ?? 0)
  }
  window.location.assign(
    `/api/deck-export/${target}${sep}jobId=${started.jobId}&download=1`,
  )
}
