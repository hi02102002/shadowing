import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Captions, FileAudio, Loader2 } from 'lucide-react'

import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Progress } from '#/components/ui/progress'
import { importLocal } from '#/server/fns/videos'
import type { ImportResult } from '#/server/fns/videos'

/** Tải file lên theo luồng (raw body) để có tiến độ và không giới hạn bởi FormData */
export function uploadFile(
  file: File,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
  url = '/api/uploads',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.setRequestHeader('content-type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('x-filename', encodeURIComponent(file.name))
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total)
    xhr.onload = () => {
      let body: { uploadId?: string; error?: string } | null = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* không phải JSON */
      }
      if (xhr.status < 300 && body?.uploadId) resolve(body.uploadId)
      else reject(new Error(body?.error ?? `Tải file lên lỗi (HTTP ${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error('Mất kết nối khi tải file lên'))
    xhr.onabort = () => reject(new DOMException('Đã huỷ', 'AbortError'))
    signal.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}

const titleFromName = (name: string) =>
  name
    .replace(/\.[^.]+$/, '')
    .replace(/[_]+/g, ' ')
    .trim()

export interface LocalImportPending {
  kind: 'local'
  uploadId: string
  title: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onResult: (res: ImportResult, pending: LocalImportPending) => void
}

export function LocalImportDialog({ open, onOpenChange, onResult }: Props) {
  const [media, setMedia] = useState<File | null>(null)
  const [subtitle, setSubtitle] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const reset = () => {
    setMedia(null)
    setSubtitle(null)
    setTitle('')
    setProgress(0)
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!media) throw new Error('Hãy chọn file audio hoặc video')
      const name = title.trim() || titleFromName(media.name)
      abortRef.current = new AbortController()
      setProgress(0)
      const uploadId = await uploadFile(media, setProgress, abortRef.current.signal)
      const res = await importLocal({
        data: {
          uploadId,
          title: name,
          subtitle: subtitle ? await subtitle.text() : undefined,
        },
      })
      return { res, pending: { kind: 'local' as const, uploadId, title: name } }
    },
    onSuccess: ({ res, pending }) => {
      reset()
      onOpenChange(false)
      onResult(res, pending)
    },
  })

  const close = (next: boolean) => {
    if (next) return onOpenChange(true)
    abortRef.current?.abort()
    submit.reset()
    reset()
    onOpenChange(false)
  }

  const uploading = submit.isPending && progress < 1

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Học từ file trên máy</DialogTitle>
          <DialogDescription>
            Audio hoặc video (mp3, m4a, mp4, mkv…). Có file phụ đề .srt/.vtt thì chọn kèm, không có thì app sẽ tạo bằng
            Whisper.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            submit.mutate()
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="local-media" className="flex items-center gap-1.5">
              <FileAudio className="size-4" /> File audio/video
            </Label>
            <Input
              id="local-media"
              type="file"
              accept="audio/*,video/*,.mkv,.opus"
              disabled={submit.isPending}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setMedia(file)
                if (file && !title) setTitle(titleFromName(file.name))
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="local-subtitle" className="flex items-center gap-1.5">
              <Captions className="size-4" /> Phụ đề (không bắt buộc)
            </Label>
            <Input
              id="local-subtitle"
              type="file"
              accept=".srt,.vtt"
              disabled={submit.isPending}
              onChange={(e) => setSubtitle(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="local-title">Tiêu đề</Label>
            <Input
              id="local-title"
              value={title}
              maxLength={300}
              disabled={submit.isPending}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tên bài học"
            />
          </div>

          {submit.isPending && (
            <div className="flex flex-col gap-1.5 text-sm text-muted-foreground">
              <span>
                {uploading ? `Đang tải file lên… ${Math.round(progress * 100)}%` : 'Đang đọc file và tách câu…'}
              </span>
              <Progress value={uploading ? progress * 100 : 100} className={uploading ? undefined : 'animate-pulse'} />
            </div>
          )}
          {submit.error && submit.error.name !== 'AbortError' && (
            <p className="text-sm text-destructive">{submit.error.message}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Huỷ
            </Button>
            <Button type="submit" disabled={!media || submit.isPending}>
              {submit.isPending && <Loader2 className="animate-spin" />}
              Bắt đầu học
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
