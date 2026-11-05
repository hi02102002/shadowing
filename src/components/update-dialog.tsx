import { useEffect, useState } from 'react'
import { Download, Loader2, RotateCw } from 'lucide-react'

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
import { desktopBridge, useDesktopUpdate } from '#/lib/desktop'

const DISMISSED_KEY = 'update-dismissed-version'

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISSED_KEY)
  } catch {
    return null
  }
}

/**
 * Báo có bản cập nhật mới của app desktop. Không ép: chỉ tải / cài khi người dùng bấm,
 * "Để sau" thì không hỏi lại cho đến khi có bản mới hơn (vẫn cập nhật được trong Cài đặt).
 */
export function UpdateDialog() {
  const update = useDesktopUpdate()
  const [open, setOpen] = useState(false)
  // đã bấm "Cập nhật" trong phiên này → hiện tiến độ và nhắc cài khi tải xong
  const [started, setStarted] = useState(false)

  const status = update?.status
  const latest = update?.latestVersion ?? null

  useEffect(() => {
    if (status === 'available' && latest && readDismissed() !== latest)
      setOpen(true)
    if (status === 'downloaded' && started) setOpen(true)
  }, [status, latest, started])

  const bridge = desktopBridge()
  if (!update || !bridge || !latest) return null

  const later = () => {
    setOpen(false)
    if (status === 'available') {
      try {
        localStorage.setItem(DISMISSED_KEY, latest)
      } catch {
        /* chế độ riêng tư: lần mở sau hỏi lại */
      }
    }
  }

  const downloading = status === 'downloading'
  const ready = status === 'downloaded'

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => (next ? setOpen(true) : later())}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {ready
              ? 'Đã tải xong bản cập nhật'
              : `Có bản cập nhật mới ${latest}`}
          </DialogTitle>
          <DialogDescription>
            {ready
              ? 'Khởi động lại Shadowing để cài bản mới. Bạn cũng có thể cài sau, dữ liệu học vẫn được giữ nguyên.'
              : `Bạn đang dùng bản ${update.currentVersion}. Cập nhật khi nào tiện, không bắt buộc.`}
          </DialogDescription>
        </DialogHeader>

        {downloading && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Progress value={update.progress * 100} className="h-1.5" />
            <span className="shrink-0 font-mono text-xs">
              {Math.round(update.progress * 100)}%
            </span>
          </div>
        )}
        {status === 'error' && update.error && (
          <p className="text-sm text-destructive">
            Không cập nhật được: {update.error}
          </p>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void bridge.updater.openRelease()}
          >
            Xem có gì mới
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={later}>
              {downloading ? 'Ẩn' : 'Để sau'}
            </Button>
            {ready ? (
              <Button
                type="button"
                onClick={() => void bridge.updater.install()}
              >
                <RotateCw />
                Khởi động lại để cài
              </Button>
            ) : (
              <Button
                type="button"
                disabled={downloading}
                onClick={() => {
                  if (update.canInstall) {
                    setStarted(true)
                    void bridge.updater.download()
                  } else {
                    // macOS chưa ký: không tự cài được, mở trang tải
                    void bridge.updater.openRelease()
                    later()
                  }
                }}
              >
                {downloading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                {update.canInstall ? 'Cập nhật' : 'Tải bản mới'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
