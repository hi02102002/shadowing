import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'
import {
  ArrowLeft,
  Ear,
  Loader2,
  RotateCcw,
  Snail,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Volume2,
} from 'lucide-react'

import { AccentSwitch, useWordsIpa } from '#/components/ipa-shared'
import { RecordDrill } from '#/components/record-drill'
import type { DrillTarget } from '#/components/record-drill'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '#/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { useAccent } from '#/hooks/use-app-settings'
import { useStopSpeechOnLeave } from '#/hooks/use-stop-speech'
import {
  DEFAULT_SHADOWING_SET,
  PILLARS,
  SHADOWING_LEVELS,
  chunkMarked,
  stressVariant,
} from '#/lib/shadowing-basics'
import type {
  IntonationDirection,
  Pillar,
  PillarId,
  ShadowingLevel,
  ShadowingSet,
} from '#/lib/shadowing-basics'
import type { Accent } from '#/lib/speech'
import { speak, speakAndWait, stopSpeech } from '#/lib/speech'
import { cn } from '#/lib/utils'
import { generateShadowingSet } from '#/server/fns/shadowing'

const searchSchema = z.object({
  /** chủ đề nhiệm vụ khi mở từ Lộ trình */
  topic: z.string().optional().catch(undefined),
  level: z.enum(SHADOWING_LEVELS).optional().catch(undefined),
})

export const Route = createFileRoute('/ipa/shadowing')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Shadowing là gì? · Luyện IPA' }] }),
  component: ShadowingBasicsPage,
})

function ShadowingBasicsPage() {
  const [accent] = useAccent()
  const { topic, level } = Route.useSearch()
  const [aiSet, setAiSet] = useState<{ topic: string; set: ShadowingSet } | null>(null)
  const set = aiSet?.set ?? DEFAULT_SHADOWING_SET
  useStopSpeechOnLeave()

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link
            to="/ipa"
            className="flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Luyện IPA
          </Link>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Ear className="size-6 text-primary" />
            Shadowing là gì?
          </h1>
          <p className="text-sm text-muted-foreground">
            Shadowing là nghe rồi nói theo gần như đồng thời, bắt chước cả giọng
            lẫn cách nói. Muốn bắt chước tốt, hãy để ý 4 thứ: âm, trọng âm, ngữ
            điệu và nhịp điệu.
          </p>
        </div>
        <AccentSwitch />
      </header>

      <AiSetPanel
        roadmapTopic={topic}
        initialLevel={level ?? 'B1'}
        active={aiSet?.topic ?? null}
        onGenerated={(t, s) => setAiSet({ topic: t, set: s })}
        onReset={() => setAiSet(null)}
      />

      <Tabs defaultValue="sound">
        <TabsList>
          {PILLARS.map((p) => (
            <TabsTrigger key={p.id} value={p.id}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {PILLARS.map((p) => (
          <TabsContent
            key={p.id}
            value={p.id}
            className="mt-3 flex flex-col gap-5"
          >
            <PillarIntro pillar={p} />
            {p.id === 'sound' && <SoundPart accent={accent} set={set} />}
            {p.id === 'stress' && <StressPart accent={accent} set={set} />}
            {p.id === 'intonation' && <IntonationPart accent={accent} set={set} />}
            {p.id === 'rhythm' && <RhythmPart accent={accent} set={set} />}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

/** AI soạn câu luyện cho cả 4 trụ cột theo chủ đề; mở từ Lộ trình thì điền sẵn chủ đề + cấp độ của nhiệm vụ */
function AiSetPanel({
  roadmapTopic,
  initialLevel,
  active,
  onGenerated,
  onReset,
}: {
  roadmapTopic?: string
  initialLevel: ShadowingLevel
  active: string | null
  onGenerated: (topic: string, set: ShadowingSet) => void
  onReset: () => void
}) {
  const [topic, setTopic] = useState(roadmapTopic ?? '')
  const [level, setLevel] = useState<ShadowingLevel>(initialLevel)
  const gen = useMutation({
    mutationFn: (t: string) => generateShadowingSet({ data: { topic: t, level } }),
    onSuccess: (s, t) => onGenerated(t, s),
  })
  const trimmed = topic.trim()

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="size-4 text-primary" />
        <h2 className="font-semibold">Câu luyện theo chủ đề</h2>
        {roadmapTopic && <Badge variant="secondary">Từ lộ trình</Badge>}
      </div>
      <p className="text-sm text-muted-foreground">
        {active
          ? `Đang dùng câu AI soạn cho chủ đề "${active}". Cả 4 phần bên dưới đã đổi theo.`
          : 'Nhờ AI soạn câu ví dụ cho cả 4 phần (âm, trọng âm, ngữ điệu, nhịp điệu) đúng chủ đề và cấp độ bạn đang học.'}
      </p>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed) gen.mutate(trimmed)
        }}
      >
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Chủ đề, vd: gọi món ở nhà hàng"
          maxLength={200}
          className="min-w-48 flex-1 bg-background"
        />
        <Select value={level} onValueChange={(v) => setLevel(v as ShadowingLevel)}>
          <SelectTrigger className="w-20 bg-background" aria-label="Cấp độ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHADOWING_LEVELS.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" disabled={!trimmed || gen.isPending}>
          {gen.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />}
          {gen.isPending ? 'Đang soạn…' : active ? 'Soạn lại' : 'Tạo câu bằng AI'}
        </Button>
        {active && (
          <Button type="button" variant="ghost" onClick={onReset}>
            <RotateCcw /> Câu mặc định
          </Button>
        )}
      </form>
      {gen.isError && (
        <p className="text-sm text-destructive">
          {gen.error instanceof Error ? gen.error.message : 'Không soạn được câu, hãy thử lại'}
          {' · '}
          <Link to="/settings">Mở Cài đặt</Link>
        </p>
      )}
    </section>
  )
}

function PillarIntro({ pillar }: { pillar: Pillar }) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
      <h2 className="text-lg font-semibold">
        {pillar.label}: <span className="text-primary">{pillar.vi}</span>
      </h2>
      <p className="text-sm">{pillar.summary}</p>
      <ul className="list-disc pl-5 text-sm text-muted-foreground">
        {pillar.tips.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </section>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <h3 className="flex items-center gap-2 font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function ListenButtons({ text, accent }: { text: string; accent: Accent }) {
  return (
    <span className="flex shrink-0 gap-1">
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Nghe"
        onClick={() => speak(text, { accent })}
      >
        <Volume2 />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Nghe chậm"
        onClick={() => speak(text, { accent, rate: 0.6 })}
      >
        <Snail />
      </Button>
    </span>
  )
}

/** ghi chú về giọng mẫu: TTS không điều khiển được nhấn / lên giọng */
const TTS_NOTE =
  'Giọng mẫu là giọng máy, không chủ động nhấn từ hay đổi giọng theo ý bài; hãy dựa vào chỗ được đánh dấu và tự thể hiện khi đọc.'

type PartProps = { accent: Accent; set: ShadowingSet }

function drill(targets: DrillTarget[], accent: Accent, focus: PillarId) {
  return (
    <Section title="Ghi âm và chấm">
      <RecordDrill
        // đổi bộ câu (AI soạn lại) thì làm mới khung ghi âm
        key={`${focus}:${targets.map((t) => t.text).join('|')}`}
        targets={targets}
        accent={accent}
        focus={focus}
      />
    </Section>
  )
}

function SoundPart({ accent, set }: PartProps) {
  return (
    <>
      <Section title="Nghe và để ý từng âm">
        <ul className="flex flex-col gap-3">
          {set.sound.map((ex) => (
            <li
              key={ex.text}
              className="flex items-start justify-between gap-2"
            >
              <div>
                <p className="text-lg font-medium">{ex.text.toLowerCase()}</p>
                <p className="text-sm text-muted-foreground">
                  Chú ý: {ex.focus}
                </p>
              </div>
              <ListenButtons text={ex.text} accent={accent} />
            </li>
          ))}
        </ul>
      </Section>
      {drill(
        set.sound.map((ex, i) => ({
          label: `Câu ${i + 1}`,
          text: ex.text,
          note: `Chú ý: ${ex.focus}`,
        })),
        accent,
        'sound',
      )}
    </>
  )
}

function StressPart({ accent, set }: PartProps) {
  const words = set.stressWords
  const ipa = useWordsIpa(`shadowing-stress:${words.join(',')}`, words)
  return (
    <>
      <Section title="Trọng âm từ">
        <p className="text-sm text-muted-foreground">
          Dấu ˈ trong phiên âm đứng ngay trước âm tiết được nhấn.
        </p>
        <ul className="grid gap-2 sm:grid-cols-3">
          {words.map((w) => (
            <li
              key={w}
              className="flex items-center justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <p className="text-lg font-medium">{w}</p>
                <p className="ipa text-sm text-muted-foreground">
                  {ipa?.get(w) ?? '…'}
                </p>
              </div>
              <ListenButtons text={w} accent={accent} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Trọng âm câu: nhấn từ nào, nghĩa đổi theo từ đó">
        <ul className="flex flex-col gap-2">
          {set.stressSentences.map((s) => (
            <li
              key={s.stressed}
              className="flex items-start justify-between gap-2 rounded-lg border p-3"
            >
              <div>
                <p className="text-lg font-medium">
                  {stressVariant(set.stressBase, s.stressed)}
                </p>
                <p className="text-sm text-muted-foreground">{s.meaning}</p>
              </div>
              <ListenButtons text={set.stressBase} accent={accent} />
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{TTS_NOTE}</p>
      </Section>

      {drill(
        [
          ...set.stressWords.map((w) => ({
            label: w,
            text: w,
            note: 'Nhấn đúng âm tiết có dấu ˈ trong từ điển.',
          })),
          ...set.stressSentences.map((s) => ({
            label: `Nhấn "${set.stressBase.split(' ')[s.stressed]}"`,
            text: set.stressBase,
            note: `Người học cần nhấn mạnh từ "${set.stressBase.split(' ')[s.stressed]}". ${s.meaning}`,
          })),
        ],
        accent,
        'stress',
      )}
    </>
  )
}

function Contour({ direction }: { direction: IntonationDirection }) {
  const rise = direction !== 'fall'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        rise ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
      )}
    >
      {rise ? (
        <TrendingUp className="size-3.5" />
      ) : (
        <TrendingDown className="size-3.5" />
      )}
      {direction === 'rise'
        ? 'Lên giọng'
        : direction === 'rise-tag'
          ? 'Lên giọng (xin xác nhận)'
          : 'Xuống giọng'}
    </span>
  )
}

function IntonationPart({ accent, set }: PartProps) {
  return (
    <>
      <Section title="Giọng lên hay xuống?">
        <ul className="flex flex-col gap-2">
          {set.intonation.map((ex) => {
            const words = ex.text.split(' ')
            return (
              <li
                key={ex.text}
                className="flex items-start justify-between gap-2 rounded-lg border p-3"
              >
                <div className="flex flex-col gap-1">
                  <p className="text-lg font-medium">
                    {words.map((w, i) => (
                      <span
                        key={i}
                        className={cn(
                          i === ex.stressed && 'font-bold text-primary',
                        )}
                      >
                        {w}{' '}
                      </span>
                    ))}
                  </p>
                  <Contour direction={ex.direction} />
                </div>
                <ListenButtons text={ex.text} accent={accent} />
              </li>
            )
          })}
        </ul>
        <p className="text-xs text-muted-foreground">{TTS_NOTE}</p>
      </Section>
      {drill(
        set.intonation.map((ex) => ({
          label: ex.text,
          text: ex.text,
          note: ex.note,
        })),
        accent,
        'intonation',
      )}
    </>
  )
}

function RhythmPart({ accent, set }: PartProps) {
  const [playing, setPlaying] = useState<string | null>(null)

  /** đọc lần lượt từng cụm, nghỉ ngắn giữa các cụm để nghe rõ ranh giới */
  async function playChunks(text: string, chunks: string[]) {
    stopSpeech()
    setPlaying(text)
    try {
      for (const chunk of chunks) {
        await speakAndWait(chunk, { accent, rate: 0.9, maxMs: 6_000 })
        await new Promise((r) => setTimeout(r, 350))
      }
    } finally {
      setPlaying(null)
    }
  }

  return (
    <>
      <Section title="Đọc theo cụm">
        <ul className="flex flex-col gap-2">
          {set.rhythm.map((ex) => (
            <li
              key={ex.text}
              className="flex items-start justify-between gap-2 rounded-lg border p-3"
            >
              <div className="flex flex-col gap-1">
                <p className="text-lg font-medium">
                  {chunkMarked(ex.chunks).toLowerCase()}
                </p>
                <p className="text-sm text-muted-foreground">
                  Mỗi dấu / là một chỗ ngắt nhẹ; trong cụm đọc liền.
                </p>
              </div>
              <span className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={playing != null}
                  onClick={() => void playChunks(ex.text, ex.chunks)}
                >
                  <Ear /> {playing === ex.text ? 'Đang đọc…' : 'Từng cụm'}
                </Button>
                <ListenButtons text={ex.text} accent={accent} />
              </span>
            </li>
          ))}
        </ul>
      </Section>
      {drill(
        set.rhythm.map((ex) => ({
          label: chunkMarked(ex.chunks).toLowerCase(),
          text: ex.text,
          note: `Chia cụm: ${chunkMarked(ex.chunks)}. Đọc liền trong cụm, ngắt nhẹ giữa các cụm.`,
        })),
        accent,
        'rhythm',
      )}
    </>
  )
}
