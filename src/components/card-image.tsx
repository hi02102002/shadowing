import { useState } from 'react'

import { cn } from '#/lib/utils'

/** ảnh minh hoạ của thẻ; tải lỗi (site gốc không có ảnh) thì ẩn */
export function CardImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={src}
      alt={alt}
      className={cn('max-h-56 self-center rounded-lg object-contain', className)}
      onError={() => setFailed(true)}
    />
  )
}
