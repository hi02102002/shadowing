import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  AudioLines,
  Blocks,
  BookOpen,
  BookOpenText,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Headphones,
  Layers,
  Loader2,
  Map as MapIcon,
  MessagesSquare,
  Mic,
  PenLine,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  Speech,
  Target,
  Trash2,
  Youtube,
  Zap,
} from 'lucide-react'
import { z } from 'zod'

import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Progress } from '#/components/ui/progress'
import { Textarea } from '#/components/ui/textarea'
import { useVideoImport } from '#/hooks/use-video-import'
import type { VideoSubRoute } from '#/hooks/use-video-import'
import { TALK_LEVELS } from '#/lib/conversation'
import type { TalkLevel } from '#/lib/conversation'
import { formatDuration } from '#/lib/format'
import { groupLabel } from '#/lib/grammar'
import { LEVEL_LABEL, LEVELS } from '#/lib/levels'
import type { Level } from '#/lib/levels'
import {
  LISTENING_LEVELS,
  LISTENING_SOURCES,
  LISTENING_SOURCE_INFO,
} from '#/lib/listening'
import type { ListeningLevel, ListeningSource } from '#/lib/listening'
import {
  listeningQuery,
  listeningsQuery,
  readingQuery,
  readingsQuery,
  roadmapQuery,
  roadmapsQuery,
} from '#/lib/queries'
import {
  LIBRARY_SOURCES,
  READING_LEVELS,
  READING_SOURCE_INFO,
} from '#/lib/reading-topics'
import type { LibrarySource, ReadingLevel } from '#/lib/reading-topics'
import { REFLEX_LEVELS, REFLEX_MODES } from '#/lib/reflex'
import type { ReflexLevel, ReflexMode } from '#/lib/reflex'
import {
  ROADMAP_ACTIVITY_INFO,
  ROADMAP_GOAL_PRESETS,
  ROADMAP_MINUTE_CHOICES,
  ROADMAP_MONTH_CHOICES,
  ROADMAP_SKILL_GROUPS,
  activityLabel,
  isVideoActivity,
} from '#/lib/roadmap'
import type { RoadmapActivityType } from '#/lib/roadmap'
import { cn } from '#/lib/utils'
import { importListening } from '#/server/fns/listening'
import { generateReading, importReading } from '#/server/fns/reading'
import {
  createRoadmap,
  deleteRoadmap,
  generateRoadmapWeek,
  openTaskDeck,
  swapTaskVideo,
  toggleRoadmapTask,
} from '#/server/fns/roadmap'
import type { RoadmapDetail, RoadmapSummaryItem } from '#/server/fns/roadmap'

const searchSchema = z.object({
  id: z.coerce.number().int().positive().optional().catch(undefined),
  week: z.coerce.number().int().min(1).max(52).optional().catch(undefined),
  create: z.coerce.boolean().optional().catch(undefined),
})

export const Route = createFileRoute('/roadmap')({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: 'Lộ trình học · Shadowing' }] }),
  component: RoadmapPage,
})

function activityIcon(type: string) {
  switch (type) {
    case 'shadow':
      return AudioLines
    case 'dictation':
      return PenLine
    case 'pronounce':
      return Mic
    case 'listening':
      return Headphones
    case 'reading':
      return BookOpenText
    case 'grammar':
      return BookOpen
    case 'talk':
    case 'speaking':
      return MessagesSquare
    case 'reflex':
      return Zap
    case 'chunks':
      return Blocks
    case 'ipa':
      return Speech
    case 'flashcards':
      return Layers
    default:
      return Sparkles
  }
}

function RoadmapPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/roadmap' })
  const { data: roadmaps = [], isPending } = useQuery(roadmapsQuery())

  const activeId = search.create ? undefined : (search.id ?? roadmaps[0]?.id)

  if (isPending) {
    return (
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>Đang tải lộ trình học…</span>
      </div>
    )
  }

  if (!activeId || search.create) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
        <RoadmapCreator
          hasExisting={roadmaps.length > 0}
          onCancel={
            roadmaps.length > 0
              ? () =>
                  void navigate({
                    search: { id: roadmaps[0].id },
                  })
              : undefined
          }
          onCreated={(id) =>
            void navigate({
              search: { id, week: 1 },
            })
          }
        />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
      <RoadmapDashboard
        key={activeId}
        roadmapId={activeId}
        roadmaps={roadmaps}
        selectedWeek={search.week}
        onSelectRoadmap={(id) =>
          void navigate({ search: { id, week: undefined } })
        }
        onSelectWeek={(week) =>
          void navigate({
            search: (prev) => ({ ...prev, id: activeId, week }),
          })
        }
        onCreateNew={() => void navigate({ search: { create: true } })}
      />
    </div>
  )
}

function RoadmapCreator({
  hasExisting,
  onCancel,
  onCreated,
}: {
  hasExisting: boolean
  onCancel?: () => void
  onCreated: (id: number) => void
}) {
  const queryClient = useQueryClient()
  const [presetId, setPresetId] = useState<string>(ROADMAP_GOAL_PRESETS[0].id)
  const [goal, setGoal] = useState<string>(ROADMAP_GOAL_PRESETS[0].goalText)
  const [currentLevel, setCurrentLevel] = useState<Level>('A2')
  const [targetLevel, setTargetLevel] = useState<Level>('B2')
  const [durationMonths, setDurationMonths] = useState<number>(
    ROADMAP_GOAL_PRESETS[0].defaultMonths,
  )
  const [dailyMinutes, setDailyMinutes] = useState<number>(
    ROADMAP_GOAL_PRESETS[0].defaultMinutes,
  )
  const [skills, setSkills] = useState<RoadmapActivityType[]>(
    ROADMAP_GOAL_PRESETS[0].defaultSkills,
  )

  const applyPreset = (id: string) => {
    setPresetId(id)
    const preset = ROADMAP_GOAL_PRESETS.find((p) => p.id === id)
    if (!preset) return
    setGoal(preset.goalText)
    setDurationMonths(preset.defaultMonths)
    setDailyMinutes(preset.defaultMinutes)
    setSkills(preset.defaultSkills)
  }

  const toggleSkill = (skill: RoadmapActivityType) => {
    setSkills((prev) =>
      prev.includes(skill)
        ? prev.length > 1
          ? prev.filter((s) => s !== skill)
          : prev
        : [...prev, skill],
    )
  }

  const create = useMutation({
    mutationFn: () =>
      createRoadmap({
        data: {
          goal: goal.trim(),
          currentLevel,
          targetLevel,
          durationMonths,
          dailyMinutes,
          focusSkills: skills,
        },
      }),
    onSuccess: async ({ id }) => {
      await queryClient.invalidateQueries({
        queryKey: roadmapsQuery().queryKey,
      })
      onCreated(id)
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <MapIcon className="size-6 text-primary" />
            Thiết kế lộ trình học cá nhân hoá
          </h1>
          <p className="text-sm text-muted-foreground">
            Cho biết mục tiêu, trình độ và quỹ thời gian của bạn. AI sẽ lập lộ
            trình theo từng giai đoạn, từng tuần và từng ngày, đồng thời tự động
            tìm video trên YouTube / ELLLO cùng bài Đọc, Nghe, Ngữ pháp phù hợp.
          </p>
        </div>
        {hasExisting && onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Quay lại lộ trình đang học
          </Button>
        )}
      </header>

      <form
        className="flex flex-col gap-6 rounded-2xl border bg-card p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (goal.trim().length >= 5 && !create.isPending) {
            create.mutate()
          }
        }}
      >
        {/* 1. Chọn mục tiêu mẫu hoặc tự nhập */}
        <div className="flex flex-col gap-3">
          <label className="text-sm font-semibold">
            1. Mục tiêu của bạn là gì?
          </label>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {ROADMAP_GOAL_PRESETS.map((preset) => {
              const active = presetId === preset.id
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors',
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-muted/60',
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {preset.label}
                    </span>
                    <Badge variant={active ? 'default' : 'secondary'}>
                      {preset.defaultMonths} tháng · {preset.defaultMinutes}p/ngày
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {preset.summary}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground">
              Mô tả cụ thể mong muốn của bạn (có thể sửa lại theo nhu cầu cá
              nhân, ví dụ ngành nghề, tình huống muốn dùng tiếng Anh):
            </span>
            <Textarea
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Ví dụ: Tôi muốn thành thạo giao tiếp trong 6 tháng để nói chuyện tự nhiên với đồng nghiệp nước ngoài, nghe hiểu cuộc họp và đọc tài liệu..."
              required
            />
          </div>
        </div>

        {/* 2. Trình độ hiện tại & Trình độ mục tiêu */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">
              2. Trình độ hiện tại
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {LEVELS.map((lv) => (
                <button
                  key={lv}
                  type="button"
                  onClick={() => {
                    setCurrentLevel(lv)
                    if (LEVELS.indexOf(targetLevel) < LEVELS.indexOf(lv)) {
                      setTargetLevel(lv)
                    }
                  }}
                  className={cn(
                    'flex flex-col items-center rounded-lg border px-2 py-2 text-xs transition-colors',
                    currentLevel === lv
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  <span className="text-sm font-bold">{lv}</span>
                  <span className="truncate text-[10px] opacity-85">
                    {LEVEL_LABEL[lv]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">
              3. Trình độ mục tiêu
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {LEVELS.map((lv) => {
                const disabled =
                  LEVELS.indexOf(lv) < LEVELS.indexOf(currentLevel)
                return (
                  <button
                    key={lv}
                    type="button"
                    disabled={disabled}
                    onClick={() => setTargetLevel(lv)}
                    className={cn(
                      'flex flex-col items-center rounded-lg border px-2 py-2 text-xs transition-colors',
                      targetLevel === lv
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                      disabled && 'cursor-not-allowed opacity-35',
                    )}
                  >
                    <span className="text-sm font-bold">{lv}</span>
                    <span className="truncate text-[10px] opacity-85">
                      {LEVEL_LABEL[lv]}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* 3. Thời hạn lộ trình & Thời gian học mỗi ngày */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">
              4. Thời gian lộ trình ({durationMonths} tháng ·{' '}
              {durationMonths * 4} tuần)
            </label>
            <div className="flex flex-wrap gap-2">
              {ROADMAP_MONTH_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDurationMonths(m)}
                  className={cn(
                    'rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
                    durationMonths === m
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {m} tháng ({m * 4} tuần)
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold">
              5. Thời lượng học mỗi ngày
            </label>
            <div className="flex flex-wrap gap-2">
              {ROADMAP_MINUTE_CHOICES.map((mins) => (
                <button
                  key={mins}
                  type="button"
                  onClick={() => setDailyMinutes(mins)}
                  className={cn(
                    'rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors',
                    dailyMinutes === mins
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {mins} phút/ngày
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Chọn kỹ năng muốn đưa vào lộ trình */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-sm font-semibold">
              6. Các kỹ năng muốn đưa vào lịch học từng ngày (đã chọn{' '}
              {skills.length})
            </label>
            <button
              type="button"
              onClick={() =>
                setSkills(
                  ROADMAP_SKILL_GROUPS.flatMap((g) => g.skills),
                )
              }
              className="text-xs font-medium text-primary hover:underline"
            >
              Chọn tất cả kỹ năng
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROADMAP_SKILL_GROUPS.map((group) => (
              <div
                key={group.id}
                className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-3.5"
              >
                <span className="text-xs font-semibold text-muted-foreground">
                  {group.label}
                </span>
                <div className="flex flex-col gap-1.5">
                  {group.skills.map((skill) => {
                    const info = ROADMAP_ACTIVITY_INFO[skill]
                    const checked = skills.includes(skill)
                    const Icon = activityIcon(skill)
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className={cn(
                          'flex items-start gap-2.5 rounded-lg border p-2.5 text-left transition-colors',
                          checked
                            ? 'border-primary/60 bg-background shadow-xs'
                            : 'border-transparent opacity-65 hover:bg-background/60 hover:opacity-100',
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 grid size-5 shrink-0 place-items-center rounded',
                            checked
                              ? 'bg-primary text-primary-foreground'
                              : 'border bg-muted',
                          )}
                        >
                          <Icon className="size-3.5" />
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-xs font-semibold">
                            {info.label}
                          </span>
                          <span className="text-[11px] leading-snug text-muted-foreground">
                            {info.detail}
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {create.error && (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {create.error.message}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <p className="text-xs text-muted-foreground">
            {create.isPending
              ? 'AI đang thiết kế khung lộ trình và tìm kiếm video YouTube / ELLLO cùng bài học cho Tuần 1 (khoảng 15–30 giây)…'
              : 'Lộ trình sẽ tự động chọn video từ thư viện của bạn hoặc tìm trên ELLLO & YouTube.'}
          </p>
          <Button
            type="submit"
            size="lg"
            disabled={create.isPending || goal.trim().length < 5}
          >
            {create.isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Đang lập lộ trình & tìm học liệu…
              </>
            ) : (
              <>
                <Sparkles />
                Tạo lộ trình học ngay
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function RoadmapDashboard({
  roadmapId,
  roadmaps,
  selectedWeek,
  onSelectRoadmap,
  onSelectWeek,
  onCreateNew,
}: {
  roadmapId: number
  roadmaps: RoadmapSummaryItem[]
  selectedWeek?: number
  onSelectRoadmap: (id: number) => void
  onSelectWeek: (week: number) => void
  onCreateNew: () => void
}) {
  const queryClient = useQueryClient()
  const { data, isPending, error } = useQuery(roadmapQuery(roadmapId))
  const { importUrl, importing, error: importError, dialog } = useVideoImport()

  const remove = useMutation({
    mutationFn: () => deleteRoadmap({ data: { id: roadmapId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: roadmapsQuery().queryKey,
      })
      const remaining = roadmaps.filter((r) => r.id !== roadmapId)
      if (remaining[0]) onSelectRoadmap(remaining[0].id)
      else onCreateNew()
    },
  })

  // Tính tuần mặc định đang học (tuần đầu tiên còn bài chưa hoàn thành, hoặc tuần 1)
  const activeWeek = useMemo(() => {
    if (selectedWeek) return selectedWeek
    if (!data) return 1
    const firstIncomplete = data.tasks.find((t) => !t.completedAt)
    return firstIncomplete?.weekNumber ?? 1
  }, [data, selectedWeek])

  const generateWeek = useMutation({
    mutationFn: (weekNumber: number) =>
      generateRoadmapWeek({ data: { roadmapId, weekNumber } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: roadmapQuery(roadmapId).queryKey,
        }),
        queryClient.invalidateQueries({
          queryKey: roadmapsQuery().queryKey,
        }),
      ])
    },
  })

  // Lộ trình vừa tạo chưa có task nào: tự sinh Tuần 1 một lần
  const autoStarted = useRef<number | null>(null)
  useEffect(() => {
    if (!data || autoStarted.current === roadmapId) return
    if (data.tasks.length === 0 && !generateWeek.isPending) {
      autoStarted.current = roadmapId
      generateWeek.mutate(1)
    }
  }, [data, generateWeek, roadmapId])

  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span>Đang tải chi tiết lộ trình…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-sm text-destructive">
        Không tải được lộ trình: {error.message}
      </div>
    )
  }

  const { roadmap, tasks } = data
  const totalGenerated = tasks.length
  const totalCompleted = tasks.filter((t) => t.completedAt).length
  const progressPct = totalGenerated
    ? Math.round((totalCompleted / totalGenerated) * 100)
    : 0

  const weekPlan =
    roadmap.weeks.find((w) => w.week === activeWeek) ?? roadmap.weeks.at(0)
  const weekTasks = tasks.filter((t) => t.weekNumber === activeWeek)

  // Nhóm các task của tuần đang chọn theo ngày (1..7)
  const daysMap = new Map<
    number,
    { dayNumber: number; dayTitle: string; tasks: typeof weekTasks }
  >()
  for (const t of weekTasks) {
    const cur = daysMap.get(t.dayNumber) ?? {
      dayNumber: t.dayNumber,
      dayTitle: t.dayTitle,
      tasks: [],
    }
    cur.tasks.push(t)
    daysMap.set(t.dayNumber, cur)
  }
  const days = [...daysMap.values()].sort((a, b) => a.dayNumber - b.dayNumber)

  // Ngày tiếp theo chưa hoàn thành hết trong tuần hiện tại
  const nextActiveDayNumber = days.find((d) =>
    d.tasks.some((t) => !t.completedAt),
  )?.dayNumber

  return (
    <div className="flex flex-col gap-6">
      {dialog}

      {/* Thanh chuyển đổi giữa các lộ trình + tạo mới */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {roadmaps.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectRoadmap(r.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                r.id === roadmap.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <MapIcon className="size-3.5" />
              <span className="max-w-56 truncate">{r.title}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCreateNew}>
            <Plus className="size-4" />
            Lộ trình mới
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => remove.mutate()}
            disabled={remove.isPending}
            title="Xoá lộ trình này"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Header tổng quan lộ trình */}
      <section className="flex flex-col gap-4 rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">
                {roadmap.currentLevel} → {roadmap.targetLevel}
              </Badge>
              <Badge variant="secondary">
                {roadmap.durationMonths} tháng ({roadmap.totalWeeks} tuần)
              </Badge>
              <Badge variant="outline">
                <Clock className="mr-1 size-3" />
                {roadmap.dailyMinutes} phút/ngày
              </Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {roadmap.title}
            </h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Mục tiêu:</span>{' '}
              {roadmap.goal}
            </p>
          </div>

          <div className="flex min-w-52 flex-col gap-1.5 rounded-xl border bg-muted/30 p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Tiến độ bài đã mở</span>
              <span className="font-semibold">
                {totalCompleted}/{totalGenerated} nhiệm vụ ({progressPct}%)
              </span>
            </div>
            <Progress value={progressPct} />
          </div>
        </div>

        <p className="rounded-xl bg-muted/40 p-3.5 text-sm leading-relaxed text-muted-foreground">
          {roadmap.summary}
        </p>

        {/* Các giai đoạn lớn (Phases) */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roadmap.phases.map((phase) => (
            <div
              key={phase.index}
              className="flex flex-col gap-2 rounded-xl border bg-background p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary">
                  Giai đoạn {phase.index} · {phase.weeks} tuần
                </span>
                <Badge variant="outline">{phase.targetLevel}</Badge>
              </div>
              <h3 className="text-sm font-semibold">{phase.title}</h3>
              <p className="text-xs text-muted-foreground">{phase.focus}</p>
              {phase.milestones.length > 0 && (
                <ul className="mt-auto flex flex-col gap-1 border-t pt-2 text-[11px] text-muted-foreground">
                  {phase.milestones.map((m, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <Target className="mt-0.5 size-3 shrink-0 text-primary" />
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Thanh chọn Tuần (Week 1 .. totalWeeks) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">
            Lịch học theo tuần (Tuần 1 – Tuần {roadmap.totalWeeks})
          </h2>
          <span className="text-xs text-muted-foreground">
            Bấm vào tuần bất kỳ để xem hoặc tạo lịch 7 ngày chi tiết
          </span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {roadmap.weeks.map((w) => {
            const wTasks = tasks.filter((t) => t.weekNumber === w.week)
            const wDone = wTasks.filter((t) => t.completedAt).length
            const isSelected = w.week === activeWeek
            const isComplete = wTasks.length > 0 && wDone === wTasks.length

            return (
              <button
                key={w.week}
                type="button"
                onClick={() => onSelectWeek(w.week)}
                className={cn(
                  'flex min-w-40 shrink-0 flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'bg-card hover:bg-muted/60',
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="text-xs font-bold">Tuần {w.week}</span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      isComplete
                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : wTasks.length > 0
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {wTasks.length > 0
                      ? `${wDone}/${wTasks.length} bài`
                      : w.level}
                  </span>
                </div>
                <span className="line-clamp-1 text-xs font-medium">
                  {w.title}
                </span>
                <span className="line-clamp-1 text-[11px] text-muted-foreground">
                  {w.theme}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {importError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {importError.message}
        </p>
      )}

      {/* Nội dung chi tiết của Tuần đang chọn */}
      {weekPlan && (
        <section className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 p-4">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{weekPlan.level}</Badge>
                <span className="text-sm font-semibold">
                  Tuần {weekPlan.week}: {weekPlan.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Chủ đề: {weekPlan.theme} · Kỹ năng:{' '}
                {weekPlan.focusSkills.map(activityLabel).join(', ')}
              </p>
            </div>

            {days.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateWeek.mutate(activeWeek)}
                disabled={generateWeek.isPending}
              >
                {generateWeek.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Tạo lại tuần {activeWeek}
              </Button>
            )}
          </div>

          {generateWeek.error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {generateWeek.error.message}
            </p>
          )}

          {days.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed bg-card p-10 text-center">
              <Calendar className="size-10 text-primary/70" />
              <div className="flex max-w-lg flex-col gap-1.5">
                <h3 className="text-lg font-semibold">
                  Tuần {activeWeek}: {weekPlan.title} ({weekPlan.level})
                </h3>
                <p className="text-sm text-muted-foreground">
                  Chủ đề trọng tâm: <b>{weekPlan.theme}</b>. Bấm nút bên dưới để
                  AI lên lịch chi tiết cho từng ngày (Ngày 1 → Ngày 7) và tự
                  động tìm kiếm video trên YouTube / ELLLO cùng bài Đọc, Nghe,
                  Ngữ pháp cho tuần này.
                </p>
              </div>
              <Button
                size="lg"
                onClick={() => generateWeek.mutate(activeWeek)}
                disabled={generateWeek.isPending}
              >
                {generateWeek.isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Đang lập lịch 7 ngày & tìm video YouTube / ELLLO…
                  </>
                ) : (
                  <>
                    <Sparkles />
                    Tạo lịch học 7 ngày cho Tuần {activeWeek}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {days.map((day) => {
                const doneCount = day.tasks.filter((t) => t.completedAt).length
                const allDone =
                  day.tasks.length > 0 && doneCount === day.tasks.length
                const isTodayFocus = day.dayNumber === nextActiveDayNumber
                const totalMins = day.tasks.reduce(
                  (sum, t) => sum + t.durationMinutes,
                  0,
                )

                return (
                  <div
                    key={day.dayNumber}
                    className={cn(
                      'flex flex-col gap-3.5 rounded-2xl border bg-card p-4 sm:p-5',
                      isTodayFocus && 'border-primary/70 ring-1 ring-primary/30',
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-xs font-bold',
                            allDone
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : isTodayFocus
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground',
                          )}
                        >
                          Ngày {day.dayNumber}
                        </span>
                        {isTodayFocus && (
                          <Badge variant="secondary" className="text-primary">
                            Hôm nay học gì
                          </Badge>
                        )}
                        <h3 className="text-base font-semibold">
                          {day.dayTitle}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5" />
                          {totalMins} phút
                        </span>
                        <span className="font-medium">
                          {doneCount}/{day.tasks.length} hoàn thành
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3">
                      {day.tasks.map((task) => (
                        <RoadmapTaskItem
                          key={task.id}
                          task={task}
                          roadmapId={roadmap.id}
                          importingUrl={importing}
                          onImportVideo={(url, sub) => importUrl(url, sub)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}
    </div>
  )
}

function RoadmapTaskItem({
  task,
  roadmapId,
  importingUrl,
  onImportVideo,
}: {
  task: RoadmapDetail['tasks'][number]
  roadmapId: number
  importingUrl: string | null
  onImportVideo: (url: string, subRoute?: VideoSubRoute) => void
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const Icon = activityIcon(task.activityType)
  const completed = Boolean(task.completedAt)

  const toggle = useMutation({
    mutationFn: () =>
      toggleRoadmapTask({
        data: { taskId: task.id, completed: !completed },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: roadmapQuery(roadmapId).queryKey,
      })
      void queryClient.invalidateQueries({
        queryKey: roadmapsQuery().queryKey,
      })
    },
  })

  const swapVideo = useMutation({
    mutationFn: (preferSource?: 'elllo' | 'youtube') =>
      swapTaskVideo({ data: { taskId: task.id, preferSource } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: roadmapQuery(roadmapId).queryKey,
      })
    },
  })

  const openListening = useMutation({
    mutationFn: async () => {
      const res = task.resource
      if (
        res?.url &&
        res.source &&
        LISTENING_SOURCES.includes(res.source as ListeningSource)
      ) {
        const level: ListeningLevel = LISTENING_LEVELS.includes(
          task.level as ListeningLevel,
        )
          ? (task.level as ListeningLevel)
          : 'B1'
        return importListening({
          data: {
            source: res.source as ListeningSource,
            url: res.url,
            level,
          },
        })
      }
      return null
    },
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: listeningsQuery().queryKey })
      if (result?.id) {
        void queryClient.invalidateQueries({
          queryKey: listeningQuery(result.id).queryKey,
        })
        void navigate({ to: '/listening', search: { id: result.id } })
      } else {
        void navigate({ to: '/listening', search: {} })
      }
    },
  })

  const openReading = useMutation({
    mutationFn: async () => {
      const res = task.resource
      const level: ReadingLevel = READING_LEVELS.includes(
        task.level as ReadingLevel,
      )
        ? (task.level as ReadingLevel)
        : 'B1'
      if (
        res?.url &&
        res.source &&
        LIBRARY_SOURCES.includes(res.source as LibrarySource)
      ) {
        return importReading({
          data: {
            source: res.source as LibrarySource,
            url: res.url,
            level,
            levelLabel: level,
            format: 'standard',
          },
        })
      }
      return generateReading({
        data: {
          topic: task.topic || task.searchQuery || task.title,
          level,
          format: 'standard',
          count: 6,
        },
      })
    },
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: readingsQuery().queryKey })
      void queryClient.invalidateQueries({ queryKey: readingQuery(id).queryKey })
      void navigate({ to: '/reading', search: { id } })
    },
  })

  const openDeck = useMutation({
    mutationFn: () => openTaskDeck({ data: { taskId: task.id } }),
    onSuccess: ({ deckId }) => {
      void queryClient.invalidateQueries({
        queryKey: roadmapQuery(task.roadmapId).queryKey,
      })
      void navigate({ to: '/flashcards/study', search: { deck: deckId } })
    },
  })

  const handleStartNonVideo = () => {
    const res = task.resource
    switch (task.activityType) {
      case 'grammar':
        if (res?.unitId) {
          void navigate({
            to: '/grammar/$unitId',
            params: { unitId: res.unitId },
          })
        } else {
          void navigate({ to: '/grammar' })
        }
        return
      case 'listening':
        openListening.mutate()
        return
      case 'reading':
        openReading.mutate()
        return
      case 'talk': {
        const talkLv: TalkLevel = TALK_LEVELS.includes(task.level as TalkLevel)
          ? (task.level as TalkLevel)
          : 'B1'
        void navigate({
          to: '/talk',
          search: {
            scenario: res?.scenario,
            topic: task.topic ?? task.title,
            level: talkLv,
          },
        })
        return
      }
      case 'reflex': {
        const reflexLv: ReflexLevel = REFLEX_LEVELS.includes(
          task.level as ReflexLevel,
        )
          ? (task.level as ReflexLevel)
          : 'B1'
        const reflexMode: ReflexMode = REFLEX_MODES.includes(
          res?.reflexMode as ReflexMode,
        )
          ? (res?.reflexMode as ReflexMode)
          : 'translate'
        void navigate({
          to: '/reflex',
          search: {
            mode: reflexMode,
            level: reflexLv,
            topic: task.topic ?? undefined,
          },
        })
        return
      }
      case 'speaking':
        void navigate({ to: '/speaking' })
        return
      case 'chunks': {
        const chunkTopic = task.topic || task.searchQuery || task.title
        void navigate({
          to: '/chunks',
          search: {
            level: LEVELS.includes(task.level as Level)
              ? (task.level as Level)
              : undefined,
            q: chunkTopic || undefined,
            page: 1,
            autoGen: '1',
          },
        })
        return
      }
      case 'ipa':
        if (res?.soundId === 'shadowing') {
          void navigate({ to: '/ipa/shadowing' })
        } else if (res?.soundId) {
          void navigate({
            to: '/ipa/$soundId',
            params: { soundId: res.soundId },
          })
        } else {
          void navigate({ to: '/ipa' })
        }
        return
      case 'flashcards':
        openDeck.mutate()
        return
      default:
        void navigate({ to: '/' })
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3.5 transition-colors sm:p-4',
        completed ? 'bg-muted/30 opacity-75' : 'bg-background',
      )}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className="mt-0.5 text-muted-foreground transition-colors hover:text-primary"
          aria-label={
            completed ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu đã hoàn thành'
          }
        >
          {completed ? (
            <CheckCircle2 className="size-5 text-emerald-500" />
          ) : (
            <Circle className="size-5" />
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <Icon className="size-3" />
              {activityLabel(task.activityType)}
            </Badge>
            <Badge variant="outline">{task.level}</Badge>
            <span className="text-xs text-muted-foreground">
              {task.durationMinutes} phút
            </span>
          </div>

          <h4
            className={cn(
              'text-sm font-semibold',
              completed && 'line-through',
            )}
          >
            {task.title}
          </h4>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {task.description}
          </p>

          {/* Nếu là nhiệm vụ Video (Shadowing / Dictation / Pronounce) */}
          {isVideoActivity(task.activityType) && task.video && (
            <div className="mt-1 flex flex-col gap-3 rounded-xl border bg-muted/25 p-3 sm:flex-row sm:items-center">
              {task.video.thumbnail ? (
                <img
                  src={task.video.thumbnail}
                  alt={task.video.title}
                  className="aspect-video w-full shrink-0 rounded-lg object-cover sm:w-36"
                />
              ) : (
                <div className="grid aspect-video w-full shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground sm:w-36">
                  <AudioLines className="size-6" />
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant={
                      task.videoImported ? 'default' : 'outline'
                    }
                    className="text-[10px]"
                  >
                    {task.video.source === 'elllo'
                      ? 'ELLLO'
                      : task.video.source === 'library' || task.videoImported
                        ? 'Thư viện'
                        : 'YouTube'}
                  </Badge>
                  {task.video.channel && (
                    <span className="truncate text-xs text-muted-foreground">
                      {task.video.channel}
                    </span>
                  )}
                  {task.video.durationSec && (
                    <span className="text-xs text-muted-foreground">
                      · {formatDuration(task.video.durationSec)}
                    </span>
                  )}
                </div>
                <span className="line-clamp-2 text-sm font-medium">
                  {task.video.title}
                </span>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {task.videoImported && task.video.youtubeId ? (
                    <Button size="sm" asChild>
                      <Link
                        to={
                          task.activityType === 'dictation'
                            ? '/videos/$videoId/dictation'
                            : task.activityType === 'pronounce'
                              ? '/videos/$videoId/pronounce'
                              : '/videos/$videoId/shadow'
                        }
                        params={{ videoId: task.video.youtubeId }}
                      >
                        <Play className="size-3.5" />
                        Vào {activityLabel(task.activityType)}
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled={importingUrl !== null}
                      onClick={() =>
                        task.video &&
                        onImportVideo(task.video.url, task.activityType as VideoSubRoute)
                      }
                    >
                      {importingUrl === task.video.url ? (
                        <>
                          <Loader2 className="size-3.5 animate-spin" />
                          Đang tải phụ đề…
                        </>
                      ) : (
                        <>
                          <Play className="size-3.5" />
                          Tải & vào {activityLabel(task.activityType)}
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    disabled={swapVideo.isPending}
                    onClick={() => swapVideo.mutate(undefined)}
                    title="Tìm một video khác trên YouTube / ELLLO cho bài này"
                  >
                    {swapVideo.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Đổi video khác
                  </Button>

                  <a
                    href={task.video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                    Nguồn
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Nếu là nhiệm vụ Video nhưng chưa tìm được video tự động (cho phép bấm tìm hoặc sang Khám phá) */}
          {isVideoActivity(task.activityType) && !task.video && (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-dashed p-3">
              <span className="text-xs text-muted-foreground">
                Từ khoá gợi ý: <b>{task.searchQuery || task.topic}</b>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={swapVideo.isPending}
                  onClick={() => swapVideo.mutate('youtube')}
                >
                  {swapVideo.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Youtube className="size-3.5" />
                  )}
                  Tìm trên YouTube
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link
                    to="/explore"
                    search={{
                      level: LEVELS.includes(task.level as Level)
                        ? (task.level as Level)
                        : 'B1',
                      source: 'youtube',
                      q: task.searchQuery || task.topic || undefined,
                    }}
                  >
                    Mở trang Khám phá
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {/* Nếu là nhiệm vụ Đọc / Nghe / Ngữ pháp / Hội thoại / Phản xạ / Chunks / IPA / Thẻ từ */}
          {!isVideoActivity(task.activityType) && (
            <div className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/25 px-3.5 py-2.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {task.activityType === 'grammar' && task.resource?.unitId ? (
                  <>
                    <span className="text-xs font-semibold text-primary">
                      English Grammar in Use · Unit {task.resource.unitId}
                    </span>
                    <span className="truncate text-xs text-foreground">
                      {task.resource.unitTitle} (
                      {groupLabel(task.resource.unitGroup ?? '')})
                    </span>
                  </>
                ) : task.activityType === 'listening' && task.resource ? (
                  <>
                    <span className="text-xs font-semibold text-primary">
                      Bài nghe:{' '}
                      {(
                        LISTENING_SOURCE_INFO as Partial<
                          Record<string, { label: string }>
                        >
                      )[task.resource.source ?? '']?.label ??
                        task.resource.source}
                    </span>
                    <span className="truncate text-xs text-foreground">
                      {task.resource.itemTitle}
                    </span>
                  </>
                ) : task.activityType === 'reading' && task.resource ? (
                  <>
                    <span className="text-xs font-semibold text-primary">
                      Bài đọc:{' '}
                      {(
                        READING_SOURCE_INFO as Partial<
                          Record<string, { label: string }>
                        >
                      )[task.resource.source ?? '']?.label ?? 'AI biên soạn'}
                    </span>
                    <span className="truncate text-xs text-foreground">
                      {task.resource.itemTitle}
                    </span>
                  </>
                ) : task.activityType === 'chunks' ? (
                  <>
                    <span className="text-xs font-semibold text-primary">
                      Kho Chunks · AI theo chủ đề
                    </span>
                    <span className="truncate text-xs text-foreground">
                      {task.resource?.itemTitle ||
                        task.topic ||
                        task.searchQuery}
                    </span>
                  </>
                ) : (
                  <span className="truncate text-xs text-muted-foreground">
                    {task.resource?.itemTitle ||
                      task.topic ||
                      task.searchQuery ||
                      activityLabel(task.activityType)}
                  </span>
                )}
              </div>

              <Button
                size="sm"
                onClick={handleStartNonVideo}
                disabled={
                  openListening.isPending ||
                  openReading.isPending ||
                  openDeck.isPending
                }
              >
                {openListening.isPending ||
                openReading.isPending ||
                openDeck.isPending ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    Đang chuẩn bị bài…
                  </>
                ) : (
                  <>
                    Vào {activityLabel(task.activityType)}
                    <ArrowRight className="size-3.5" />
                  </>
                )}
              </Button>
            </div>
          )}
          {openDeck.error && (
            <p className="text-xs text-destructive">{openDeck.error.message}</p>
          )}
        </div>
      </div>
    </div>
  )
}
