import { useEffect } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export function FloatingBackButton() {
  const navigate = useNavigate()
  const pathname = useLocation({ select: (location) => location.pathname })
  const isRoot = pathname === '/'

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
    } else {
      void navigate({ to: '/' })
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // Bấm Alt + Mũi tên trái để quay lại (chuẩn desktop)
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault()
        handleBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  if (isRoot) return null

  return (
    <button
      type="button"
      onClick={handleBack}
      title="Quay lại trang trước (Alt + ←)"
      aria-label="Quay lại"
      className="fixed bottom-5 left-5 z-40 flex items-center gap-1.5 rounded-full border border-border/80 bg-background/90 px-3.5 py-2 text-xs font-medium text-foreground shadow-lg backdrop-blur-md transition-all hover:scale-105 hover:bg-accent hover:shadow-xl active:scale-95 sm:bottom-6 sm:left-6"
    >
      <ArrowLeft className="size-4 text-primary" />
      <span className="font-semibold">Quay lại</span>
    </button>
  )
}

