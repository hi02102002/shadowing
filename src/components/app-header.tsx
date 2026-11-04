import { useEffect, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  AudioLines,
  Blocks,
  BookOpen,
  BookOpenText,
  BookX,
  Compass,
  Flame,
  Headphones,
  Layers,
  Library,
  Menu,
  MessagesSquare,
  Moon,
  Settings,
  Speech,
  Sun,
  Zap,
} from 'lucide-react'

import { Button } from '#/components/ui/button'
import { statsQuery } from '#/lib/queries'
import { cn } from '#/lib/utils'

const NAV = [
  { to: '/', label: 'Thư viện', icon: Library },
  { to: '/explore', label: 'Khám phá', icon: Compass },
  { to: '/talk', label: 'Nói với AI', icon: MessagesSquare },
  { to: '/reflex', label: 'Phản xạ', icon: Zap },
  { to: '/ipa', label: 'Luyện IPA', icon: Speech },
  { to: '/reading', label: 'Đọc hiểu', icon: BookOpenText },
  { to: '/listening', label: 'Luyện nghe', icon: Headphones },
  { to: '/grammar', label: 'Ngữ pháp', icon: BookOpen },
  { to: '/chunks', label: 'Chunks', icon: Blocks },
  { to: '/flashcards', label: 'Thẻ từ', icon: Layers },
  { to: '/review', label: 'Sổ lỗi', icon: BookX },
  { to: '/settings', label: 'Cài đặt', icon: Settings },
] as const

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = useLocation({ select: (location) => location.pathname })
  const current =
    NAV.find(({ to }) =>
      to === '/' ? pathname === '/' : pathname.startsWith(to),
    ) ?? NAV[0]

  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-2 px-3 sm:gap-4 sm:px-4">
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-foreground no-underline"
        >
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <AudioLines className="size-4" />
          </span>
          <span className="hidden sm:inline">Shadowing</span>
        </Link>
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-controls="app-navigation-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium hover:bg-muted 2xl:hidden"
        >
          <Menu className="size-4 shrink-0" />
          <span className="truncate">{current.label}</span>
        </button>
        <nav className="hidden min-w-0 flex-1 items-center gap-1 2xl:flex">
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/' }}
              className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: cn('bg-muted text-foreground') }}
            >
              <Icon className="size-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <StreakBadge />
          <ThemeToggle />
        </div>
      </div>
      {menuOpen && (
        <nav
          id="app-navigation-menu"
          className="absolute inset-x-0 top-full grid grid-cols-2 gap-1 border-b bg-background p-3 shadow-lg sm:grid-cols-3 2xl:hidden"
        >
          {NAV.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === '/' }}
              onClick={() => setMenuOpen(false)}
              className="flex min-w-0 items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-muted-foreground no-underline hover:bg-muted hover:text-foreground"
              activeProps={{ className: 'bg-muted text-foreground' }}
            >
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}

/** chuỗi ngày học, bấm để xem Thống kê; hôm nay chưa học thì lửa xám (sắp mất chuỗi) */
function StreakBadge() {
  const { data, refetch } = useQuery(statsQuery())
  // vừa luyện xong ở trang khác (ôn thẻ, chép chính tả…) → cập nhật lửa khi chuyển trang
  const pathname = useLocation({ select: (l) => l.pathname })
  useEffect(() => void refetch(), [pathname, refetch])
  if (!data) return null
  const lit = data.practicedToday
  return (
    <Link
      to="/stats"
      className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-semibold text-foreground no-underline hover:bg-muted"
      activeProps={{ className: 'bg-muted' }}
      title={
        lit
          ? `Chuỗi ${data.streak} ngày — hôm nay đã học`
          : data.streak
            ? `Chuỗi ${data.streak} ngày — hôm nay chưa học, luyện một lượt để giữ chuỗi`
            : 'Bắt đầu chuỗi ngày học — xem Thống kê'
      }
    >
      <Flame
        className={cn(
          'size-4',
          lit ? 'fill-rec/30 text-rec' : 'text-muted-foreground',
        )}
      />
      <span className="tabular-nums">{data.streak}</span>
    </Link>
  )
}

function ThemeToggle() {
  const [dark, setDark] = useState(false)
  useEffect(
    () => setDark(document.documentElement.classList.contains('dark')),
    [],
  )
  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('theme', next ? 'dark' : 'light')
    } catch {
      /* private mode */
    }
  }
  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={toggle}
      aria-label="Đổi giao diện sáng/tối"
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  )
}

/** chạy trước khi render để tránh nháy màu khi dùng dark mode */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`
