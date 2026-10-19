import { createFileRoute, getRouteApi, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Ear, Keyboard, Mic, PenLine } from 'lucide-react'

import { videoQuery } from '#/lib/queries'

export const Route = createFileRoute('/videos/$videoId/')({
  component: Overview,
})

const videoRoute = getRouteApi('/videos/$videoId')

function Overview() {
  const { videoId } = videoRoute.useParams()
  const { data } = useSuspenseQuery(videoQuery(videoId))
  const done = data.segments.filter((s) => s.dictationBest != null || s.pronunciationBest != null).length
  // gợi ý câu đầu tiên chưa luyện
  const nextIdx = Math.max(0, data.segments.findIndex((s) => s.dictationBest == null && s.pronunciationBest == null))

  const cards = [
    {
      to: '/videos/$videoId/shadow' as const,
      icon: Ear,
      title: 'Shadowing',
      desc: 'Nghe và nói đuổi theo người bản xứ, có chữ chạy karaoke. Luyện ngữ điệu, nhịp và nối âm.',
    },
    {
      to: '/videos/$videoId/dictation' as const,
      icon: PenLine,
      title: 'Nghe chép chính tả',
      desc: 'Nghe từng câu rồi gõ lại. Máy chấm từng từ, AI giải thích vì sao bạn nghe nhầm.',
    },
    {
      to: '/videos/$videoId/pronounce' as const,
      icon: Mic,
      title: 'Luyện phát âm',
      desc: 'Nghe xong nhắc lại, máy nhận dạng giọng bạn để tìm từ phát âm chưa chuẩn kèm IPA và mẹo sửa.',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Bấm vào một câu trong transcript để phát từ câu đó. Đã luyện <b className="text-foreground">{done}</b>/
        {data.segments.length} câu. Chọn chế độ luyện:
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ to, icon: Icon, title, desc }) => (
          <Link
            key={to}
            to={to}
            params={{ videoId }}
            search={{ seg: nextIdx }}
            className="flex flex-col gap-2 rounded-xl border bg-card p-4 text-foreground no-underline transition-colors hover:border-primary/50 hover:bg-accent/40"
          >
            <Icon className="size-5 text-primary" />
            <span className="font-semibold">{title}</span>
            <span className="text-sm text-muted-foreground">{desc}</span>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Keyboard className="size-4" />
        <Kbd k="Space" /> phát/dừng
        <Kbd k="R" /> nghe lại câu
        <Kbd k="← →" /> câu trước/sau
        <Kbd k="L" /> lặp câu
        <Kbd k="M" /> ghi âm
      </div>
    </div>
  )
}

function Kbd({ k }: { k: string }) {
  return <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{k}</kbd>
}
