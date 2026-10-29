import { Link } from '@tanstack/react-router'

/** chuyển giữa hai kiểu luyện nói với AI: nhập vai (/talk) và nói theo đề (/speaking) */
export function SpeakTabs() {
  const tab = 'rounded-md px-3 py-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground'
  return (
    <nav className="flex w-fit gap-1 rounded-lg bg-muted p-1">
      <Link to="/talk" search={{}} className={tab} activeProps={{ className: 'bg-background text-foreground shadow-sm' }}>
        Nhập vai
      </Link>
      <Link to="/speaking" search={{}} className={tab} activeProps={{ className: 'bg-background text-foreground shadow-sm' }}>
        Nói theo đề
      </Link>
    </nav>
  )
}
