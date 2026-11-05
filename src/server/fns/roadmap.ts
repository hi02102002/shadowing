import { createServerFn } from '@tanstack/react-start'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import {
  cards,
  decks,
  grammarAnswers,
  mistakes,
  roadmapTasks,
  roadmaps,
  videos,
} from '#/db/schema.ts'
import type {
  RoadmapPhase,
  RoadmapResourceMeta,
  RoadmapTask,
  RoadmapVideoMeta,
  RoadmapWeekPlan,
} from '#/db/schema.ts'
import { SCENARIOS } from '#/lib/conversation.ts'
import { IPA_SOUNDS } from '#/lib/ipa-sounds.ts'
import { LEVELS } from '#/lib/levels.ts'
import type { Level } from '#/lib/levels.ts'
import type { ListeningSource } from '#/lib/listening.ts'
import type { LibrarySource, ReadingLevel } from '#/lib/reading-topics.ts'
import {
  ROADMAP_ACTIVITY_TYPES,
  interpolateLevel,
  isVideoActivity,
} from '#/lib/roadmap.ts'
import type { RoadmapActivityType } from '#/lib/roadmap.ts'
import { SPEAKING_TOPICS } from '#/lib/speaking-topics.ts'
import { isLocalKey, vimeoIdFromKey } from '#/lib/video-source.ts'
import { youtubeThumbnail } from '#/lib/youtube-id.ts'
import {
  ROADMAP_SYSTEM,
  RoadmapOverviewSchema,
  TOPIC_VOCAB_SYSTEM,
  TopicVocabSchema,
  topicVocabPrompt,
  RoadmapWeekDaysSchema,
  roadmapOverviewPrompt,
  roadmapWeekDaysPrompt,
} from '../ai/prompts.ts'
import type { RoadmapWeekDaysOutput } from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import {
  ELLLO_VIEWS_LEVELS,
  fetchEllloBook,
  fetchEllloLevel,
  fetchEllloViews,
} from '../elllo/elllo.ts'
import { loadBook } from '../grammar/egiu.ts'
import { listeningCatalog } from '../listening/sources.ts'
import { libraryCatalog } from '../reading/sources.ts'
import { searchVideos, watchUrl } from '../youtube/ytdlp.ts'

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'of',
  'with',
  'and',
  'or',
  'about',
  'my',
  'your',
  'our',
  'their',
  'his',
  'her',
  'its',
  'this',
  'that',
  'these',
  'those',
  'a1',
  'a2',
  'b1',
  'b2',
  'c1',
  'c2',
  'beginner',
  'beginners',
  'elementary',
  'intermediate',
  'advanced',
  'english',
  'practice',
  'conversation',
  'conversations',
  'dialogue',
  'dialogues',
  'listening',
  'reading',
  'speaking',
  'shadowing',
  'dictation',
  'pronunciation',
  'vocabulary',
  'video',
  'lesson',
  'unit',
  'part',
  'episode',
  'test',
  'quiz',
  'comprehension',
  'phrases',
  'reflex',
  'roleplay',
  'trong',
  'cho',
  'khi',
  'theo',
  'nhu',
  'nay',
  'cau',
  'bai',
  'hoc',
])

const AUX_WORDS = new Set([
  'be',
  'am',
  'is',
  'are',
  'was',
  'were',
  'been',
  'being',
  'do',
  'does',
  'did',
  'done',
  'doing',
  'have',
  'has',
  'had',
  'having',
  'get',
  'got',
  'use',
  'used',
  'in',
  'at',
  'on',
  'for',
  'by',
  'from',
])

const tokenMemo = new Map<string, string[]>()

export function tokenizeQuery(text: string): string[] {
  const hit = tokenMemo.get(text)
  if (hit) return hit
  const words = text
    .toLowerCase()
    .split(/[\s,.;:!?()[\]"'/\\–—-]+/)
    .filter((w) => w.length >= 2 && /^[a-z0-9]+$/.test(w) && !STOPWORDS.has(w))
  const out = [...new Set(words)]
  if (tokenMemo.size > 20_000) tokenMemo.clear()
  tokenMemo.set(text, out)
  return out
}

/** Tokenize query đúng một lần, dùng lại để chấm điểm cho cả catalog */
export function makeScorer(query: string): (title: string) => number {
  const tokens = tokenizeQuery(query)
  if (!tokens.length) return () => 0
  return (title) => {
    const words = tokenizeQuery(title)
    if (!words.length) return 0
    const wordSet = new Set(words)
    let score = 0
    for (const token of tokens) {
      if (wordSet.has(token)) {
        score += AUX_WORDS.has(token) ? 1 : 4
      } else if (
        !AUX_WORDS.has(token) &&
        token.length >= 4 &&
        words.some(
          (w) =>
            !AUX_WORDS.has(w) &&
            w.length >= 4 &&
            (w.startsWith(token) || token.startsWith(w)),
        )
      ) {
        score += 2
      }
    }
    return score
  }
}

/** Chấm điểm độ khớp của một tiêu đề với danh sách từ khoá truy vấn */
export function scoreKeywordMatch(title: string, query: string): number {
  return makeScorer(query)(title)
}

/** Chạy fn trên items với tối đa `limit` tác vụ song song */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i], i)
      }
    },
  )
  await Promise.all(workers)
  return out
}

interface OverviewPhase {
  index: number
  title: string
  weeks: number
  targetLevel: string
  focus: string
  milestones: string[]
  themes: Array<{ title: string; theme: string; searchKeywords: string[] }>
}

/** Ép tổng số tuần các phase đúng bằng totalWeeks và đánh lại index */
export function normalizePhases<P extends { weeks: number }>(
  phases: P[],
  totalWeeks: number,
): Array<P & { index: number }> {
  const list = phases.slice(0, Math.max(1, totalWeeks))
  const sum = list.reduce((n, p) => n + p.weeks, 0) || 1
  const weeks = list.map((p) => Math.max(1, Math.round((p.weeks / sum) * totalWeeks)))
  let diff = totalWeeks - weeks.reduce((n, w) => n + w, 0)
  for (let guard = 0; diff !== 0 && guard < 1000; guard++) {
    const i = guard % weeks.length
    if (diff > 0) {
      weeks[i]++
      diff--
    } else if (weeks[i] > 1) {
      weeks[i]--
      diff++
    }
  }
  return list.map((p, i) => ({ ...p, weeks: weeks[i], index: i + 1 }))
}

/** Trải các chủ đề của từng phase lên từng tuần (LLM không phải liệt kê 52 tuần) */
export function expandPhasesToWeeks(opts: {
  phases: OverviewPhase[]
  currentLevel: Level
  focusSkills: RoadmapActivityType[]
}): RoadmapWeekPlan[] {
  const out: RoadmapWeekPlan[] = []
  let prevLevel: Level = opts.currentLevel
  let week = 0
  for (const phase of opts.phases) {
    const endLevel: Level = LEVELS.includes(phase.targetLevel as Level)
      ? (phase.targetLevel as Level)
      : prevLevel
    for (let i = 0; i < phase.weeks; i++) {
      week++
      const theme = phase.themes.length
        ? phase.themes[Math.floor((i / phase.weeks) * phase.themes.length)]
        : undefined
      out.push({
        week,
        phaseIndex: phase.index,
        title: theme?.title || phase.title,
        theme: theme?.theme || phase.focus,
        level: interpolateLevel(prevLevel, endLevel, i + 1, phase.weeks),
        focusSkills: opts.focusSkills,
        searchKeywords: theme?.searchKeywords ?? [],
      })
    }
    prevLevel = endLevel
  }
  return out
}

/** Đảm bảo danh sách weeks luôn phủ đủ từ 1..totalWeeks và chỉ chứa các focusSkills hợp lệ */
export function normalizeRoadmapWeeks(opts: {
  weeks: RoadmapWeekPlan[]
  phases: RoadmapPhase[]
  totalWeeks: number
  currentLevel: Level
  targetLevel: Level
  focusSkills: RoadmapActivityType[]
}): RoadmapWeekPlan[] {
  const allowed = new Set<string>(opts.focusSkills)
  const byWeek = new Map(opts.weeks.map((w) => [w.week, w]))
  const out: RoadmapWeekPlan[] = []

  for (let w = 1; w <= opts.totalWeeks; w++) {
    const existing = byWeek.get(w) ?? opts.weeks.at(w - 1)
    const filteredSkills = (existing?.focusSkills ?? []).filter((s) =>
      allowed.has(s),
    )
    const fallbackLevel = interpolateLevel(
      opts.currentLevel,
      opts.targetLevel,
      w,
      opts.totalWeeks,
    )
    out.push({
      week: w,
      phaseIndex:
        existing?.phaseIndex ??
        Math.min(
          opts.phases.length || 1,
          Math.ceil((w / opts.totalWeeks) * (opts.phases.length || 1)),
        ),
      title: existing?.title || `Tuần ${w}`,
      theme: existing?.theme || 'Luyện tập theo lộ trình',
      level:
        existing && LEVELS.includes(existing.level as Level)
          ? existing.level
          : fallbackLevel,
      focusSkills: filteredSkills.length ? filteredSkills : opts.focusSkills,
      searchKeywords: existing?.searchKeywords.length
        ? existing.searchKeywords
        : ['daily conversation', 'english practice'],
    })
  }
  return out
}

const ELLLO_CACHE_MS = 6 * 60 * 60 * 1000
const ellloCache = new Map<
  string,
  { at: number; items: RoadmapVideoMeta[] }
>()

async function getEllloCandidates(level: Level): Promise<RoadmapVideoMeta[]> {
  const key = `elllo-all:${level}`
  const hit = ellloCache.get(key)
  if (hit && Date.now() - hit.at < ELLLO_CACHE_MS) return hit.items

  const results: RoadmapVideoMeta[] = []
  const settled = await Promise.allSettled([
    fetchEllloLevel(level),
    ELLLO_VIEWS_LEVELS.includes(level as any)
      ? fetchEllloViews(level as any)
      : Promise.resolve([]),
    fetchEllloBook(),
  ])

  if (settled[0].status === 'fulfilled') {
    for (const item of settled[0].value) {
      results.push({
        source: 'elllo',
        url: item.url,
        title: item.title,
        channel: `ELLLO Video · ${level}`,
        thumbnail: item.thumbnail,
      })
    }
  }
  if (settled[1].status === 'fulfilled') {
    for (const item of settled[1].value) {
      results.push({
        source: 'elllo',
        url: item.url,
        title: item.title,
        channel: `ELLLO Views · ${level}`,
        thumbnail: item.thumbnail,
      })
    }
  }
  if (settled[2].status === 'fulfilled') {
    for (const item of settled[2].value.filter((b) => b.level === level)) {
      results.push({
        source: 'elllo',
        url: item.url,
        title: item.title,
        channel: `ELLLO Grammar · ${level}`,
      })
    }
  }

  if (results.length > 0) {
    ellloCache.set(key, { at: Date.now(), items: results })
  }
  return results
}

/** Chọn video tốt nhất từ danh sách ứng viên chưa được dùng */
export function pickBestVideo(
  candidates: RoadmapVideoMeta[],
  query: string,
  usedUrls: Set<string>,
  usedYoutubeIds: Set<string>,
): RoadmapVideoMeta | null {
  const available = candidates.filter(
    (c) =>
      !usedUrls.has(c.url) &&
      (!c.youtubeId || !usedYoutubeIds.has(c.youtubeId)),
  )
  if (!available.length) return null

  let best = available[0]
  let bestScore = -1
  for (const item of available) {
    const score = scoreKeywordMatch(item.title, query)
    if (score > bestScore) {
      bestScore = score
      best = item
    }
  }
  return best
}

const YT_CACHE_MS = 3 * 60 * 60 * 1000
const ytSearchCache = new Map<
  string,
  { at: number; promise: Promise<Awaited<ReturnType<typeof searchVideos>>> }
>()

/** yt-dlp search có cache theo query và gộp các request đang chạy */
function searchYoutubeCached(query: string) {
  const key = query.toLowerCase().replace(/\s+/g, ' ').trim()
  const hit = ytSearchCache.get(key)
  if (hit && Date.now() - hit.at < YT_CACHE_MS) return hit.promise
  const promise = searchVideos(key, 1, 8)
  ytSearchCache.set(key, { at: Date.now(), promise })
  promise.catch(() => {
    if (ytSearchCache.get(key)?.promise === promise) ytSearchCache.delete(key)
  })
  return promise
}

function youtubeQueryFor(opts: {
  searchQuery: string
  topic: string
  level: Level
}) {
  return `${opts.searchQuery || opts.topic} ${opts.level} English conversation`
}

function videoKeyToUrl(youtubeId: string): string {
  const vimeoId = vimeoIdFromKey(youtubeId)
  return vimeoId ? `https://vimeo.com/${vimeoId}` : watchUrl(youtubeId)
}

async function resolveTaskVideo(opts: {
  level: Level
  topic: string
  searchQuery: string
  preferredSource: string
  existingVideoId?: string | null
  libraryVideos: Array<{
    youtubeId: string
    title: string
    channel: string | null
    thumbnail: string | null
    durationSec: number | null
  }>
  usedUrls: Set<string>
  usedYoutubeIds: Set<string>
  skipLibrary?: boolean
}): Promise<RoadmapVideoMeta | null> {
  const query = `${opts.searchQuery} ${opts.topic}`.trim()
  const ownedIds = new Set(opts.libraryVideos.map((v) => v.youtubeId))

  const markUsed = (video: RoadmapVideoMeta): RoadmapVideoMeta => {
    opts.usedUrls.add(video.url)
    if (video.youtubeId) opts.usedYoutubeIds.add(video.youtubeId)
    return video
  }

  // 1. Kiểm tra video có sẵn trong thư viện của người dùng
  if (!opts.skipLibrary) {
    if (opts.existingVideoId) {
      const found = opts.libraryVideos.find(
        (v) =>
          v.youtubeId === opts.existingVideoId &&
          !isLocalKey(v.youtubeId) &&
          !opts.usedYoutubeIds.has(v.youtubeId),
      )
      if (found) {
        const url = videoKeyToUrl(found.youtubeId)
        return markUsed({
          source: 'library',
          url,
          youtubeId: found.youtubeId,
          title: found.title,
          channel: found.channel ?? 'Thư viện của bạn',
          thumbnail: found.thumbnail ?? undefined,
          durationSec: found.durationSec ?? undefined,
        })
      }
    }

    const libCandidates: RoadmapVideoMeta[] = opts.libraryVideos
      .filter((v) => !isLocalKey(v.youtubeId))
      .map((v) => ({
        source: 'library' as const,
        url: videoKeyToUrl(v.youtubeId),
        youtubeId: v.youtubeId,
        title: v.title,
        channel: v.channel ?? 'Thư viện của bạn',
        thumbnail: v.thumbnail ?? undefined,
        durationSec: v.durationSec ?? undefined,
      }))
    const bestLib = pickBestVideo(
      libCandidates,
      query,
      opts.usedUrls,
      opts.usedYoutubeIds,
    )
    if (bestLib && scoreKeywordMatch(bestLib.title, query) >= 4) {
      return markUsed(bestLib)
    }
  }

  // 2. Ứng viên ELLLO (có cache 6 giờ, gần như miễn phí)
  const score = makeScorer(query)
  const findElllo = async (): Promise<RoadmapVideoMeta | null> => {
    try {
      const ellloItems = await getEllloCandidates(opts.level)
      return pickBestVideo(
        ellloItems,
        query,
        opts.usedUrls,
        opts.usedYoutubeIds,
      )
    } catch {
      return null
    }
  }

  // 3. Ứng viên YouTube qua yt-dlp (cache theo query)
  const findYoutube = async (): Promise<RoadmapVideoMeta | null> => {
    try {
      const entries = await searchYoutubeCached(youtubeQueryFor(opts))
      const ytCandidates: RoadmapVideoMeta[] = entries
        .filter((e) => e.duration && e.duration >= 60 && e.duration <= 960)
        .map((e) => ({
          source: ownedIds.has(e.id) ? ('library' as const) : ('youtube' as const),
          url: watchUrl(e.id),
          youtubeId: e.id,
          title: e.title,
          channel: e.channel ?? 'YouTube',
          thumbnail: youtubeThumbnail(e.id),
          durationSec: Math.round(e.duration!),
        }))
      return pickBestVideo(
        ytCandidates,
        query,
        opts.usedUrls,
        opts.usedYoutubeIds,
      )
    } catch {
      return null
    }
  }

  // Nguồn rẻ (ELLLO) thử trước trừ khi người học yêu cầu YouTube; chỉ gọi yt-dlp khi ELLLO không khớp đủ tốt
  const preferYoutube = opts.preferredSource === 'youtube'
  const first = preferYoutube ? findYoutube : findElllo
  const second = preferYoutube ? findElllo : findYoutube
  const a = await first()
  if (a && score(a.title) >= 4) return markUsed(a)
  const b = await second()
  if (b && score(b.title) >= 4) return markUsed(b)
  const fallback = a && b ? (score(a.title) >= score(b.title) ? a : b) : (a ?? b)
  return fallback ? markUsed(fallback) : null
}

/** Danh mục tóm tắt một số bài đại diện của English Grammar in Use để dự phòng khi chưa tải sách */
const FALLBACK_GRAMMAR_UNITS: Array<{
  id: string
  title: string
  group: string
}> = [
  { id: '1', title: 'Present continuous (I am doing)', group: 'Present and past' },
  { id: '2', title: 'Present simple (I do)', group: 'Present and past' },
  { id: '3', title: 'Present continuous and present simple 1', group: 'Present and past' },
  { id: '5', title: 'Past simple (I did)', group: 'Present and past' },
  { id: '6', title: 'Past continuous (I was doing)', group: 'Present and past' },
  { id: '7', title: 'Present perfect 1 (I have done)', group: 'Present perfect and past' },
  { id: '12', title: 'For and since; when … ? and how long … ?', group: 'Present perfect and past' },
  { id: '13', title: 'Present perfect and past 1 (I have done and I did)', group: 'Present perfect and past' },
  { id: '18', title: 'Used to (do)', group: 'Present perfect and past' },
  { id: '19', title: 'Present tenses (I am doing / I do) for the future', group: 'Future' },
  { id: '20', title: 'I’m going to (do)', group: 'Future' },
  { id: '21', title: 'Will and shall 1', group: 'Future' },
  { id: '26', title: 'Can, could and (be) able to', group: 'Modals' },
  { id: '29', title: 'May and might 1', group: 'Modals' },
  { id: '31', title: 'Have to and must', group: 'Modals' },
  { id: '33', title: 'Should 1', group: 'Modals' },
  { id: '38', title: 'If I do … and If I did …', group: 'If and wish' },
  { id: '39', title: 'If I knew … I wish I knew …', group: 'If and wish' },
  { id: '42', title: 'Passive 1 (is done / was done)', group: 'Passive' },
  { id: '47', title: 'Reported speech 1 (He said that …)', group: 'Reported speech' },
  { id: '49', title: 'Questions 1', group: 'Questions and auxiliary verbs' },
  { id: '53', title: 'Verb + -ing (enjoy doing / stop doing etc.)', group: '-ing and to ...' },
  { id: '54', title: 'Verb + to … (decide to … / forget to … etc.)', group: '-ing and to ...' },
  { id: '69', title: 'Countable and uncountable 1', group: 'Articles and nouns' },
  { id: '72', title: 'The 1', group: 'Articles and nouns' },
  { id: '92', title: 'Relative clauses 1: clauses with who/that/which', group: 'Relative clauses' },
  { id: '98', title: 'Adjectives ending in -ing and -ed (boring/bored etc.)', group: 'Adjectives and adverbs' },
  { id: '105', title: 'Comparative 1 (cheaper, more expensive etc.)', group: 'Adjectives and adverbs' },
  { id: '113', title: 'Although / though / even though; in spite of / despite', group: 'Conjunctions and prepositions' },
  { id: '121', title: 'At/on/in (time)', group: 'Prepositions' },
  { id: '123', title: 'In/at/on (position) 1', group: 'Prepositions' },
  { id: '137', title: 'Phrasal verbs 1: General points', group: 'Phrasal verbs' },
]

/** Vùng Unit ưu tiên theo trình độ (English Grammar in Use, Unit 1–145) */
const GRAMMAR_LEVEL_RANGE: Record<Level, [number, number]> = {
  A1: [1, 35],
  A2: [1, 75],
  B1: [15, 115],
  B2: [35, 145],
  C1: [40, 145],
}

type GrammarCatalogUnit = { id: string; title: string; group: string }

/** Các Unit chưa học, nằm trong vùng trình độ (nới ra toàn sách nếu quá ít lựa chọn) */
export function grammarUnitsForLevel(
  units: GrammarCatalogUnit[],
  level: Level,
  usedUnits: Set<string>,
): GrammarCatalogUnit[] {
  const free = units.filter(
    (u) => !u.id.startsWith('appendix-') && !usedUnits.has(u.id),
  )
  const [min, max] = GRAMMAR_LEVEL_RANGE[level]
  const inRange = free.filter((u) => {
    const n = Number(u.id)
    return n >= min && n <= max
  })
  return inRange.length >= 12 ? inRange : free
}

export function matchGrammarUnit(
  units: GrammarCatalogUnit[],
  query: string,
  level: Level,
  usedUnits: Set<string>,
  preferredUnitId?: string | null,
): {
  unitId: string
  unitTitle: string
  unitGroup: string
  /** true nếu dùng đúng Unit AI chỉ định (title/description AI viết vẫn khớp) */
  matchedPreferred: boolean
} {
  const nonAppendix = units.filter((u) => !u.id.startsWith('appendix-'))
  const available = nonAppendix.filter((u) => !usedUnits.has(u.id))
  const list = available.length
    ? available
    : nonAppendix.length
      ? nonAppendix
      : units

  // Tin Unit AI đã chọn từ danh sách nếu hợp lệ và chưa dùng; không loại bỏ chỉ vì từ khoá không khớp
  if (preferredUnitId) {
    const cleanId = preferredUnitId
      .trim()
      .replace(/^unit\s+/i, '')
      .trim()
    const direct = available.find((u) => u.id === cleanId)
    if (direct) {
      usedUnits.add(direct.id)
      return {
        unitId: direct.id,
        unitTitle: direct.title,
        unitGroup: direct.group,
        matchedPreferred: true,
      }
    }
  }

  const expandedQuery = query
    .replace(/\b(place|location|locations|places)\b/gi, '$1 position')
    .replace(/\b(wh|interrogative)\b/gi, '$1 questions')
  const scoreQuery = makeScorer(expandedQuery)

  let best = list[0]
  let bestScore = -Infinity
  const [minUnit, maxUnit] = GRAMMAR_LEVEL_RANGE[level]

  for (const u of list) {
    const num = Number(u.id) || 50
    const inRange = num >= minUnit && num <= maxUnit ? 0.5 : 0
    const titleScore = scoreQuery(u.title) * 2
    const groupScore = scoreQuery(u.group)
    const mainTitle = u.title.replace(/\(.*?\)/g, '')
    const lengthPenalty = tokenizeQuery(mainTitle).length * 0.1
    const orderPenalty = num * 0.002
    const score =
      titleScore + groupScore + inRange - lengthPenalty - orderPenalty
    if (score > bestScore) {
      bestScore = score
      best = u
    }
  }

  usedUnits.add(best.id)
  return {
    unitId: best.id,
    unitTitle: best.title,
    unitGroup: best.group,
    matchedPreferred: false,
  }
}

let grammarCatalogCache: GrammarCatalogUnit[] | null = null

async function getGrammarUnitCatalog(): Promise<GrammarCatalogUnit[]> {
  if (grammarCatalogCache) return grammarCatalogCache
  try {
    const book = await loadBook()
    if (book.length) {
      grammarCatalogCache = book.map((u) => ({
        id: u.id,
        title: u.title,
        group: u.group,
      }))
      return grammarCatalogCache
    }
  } catch {
    // dùng danh sách dự phòng nếu chưa tải được sách
  }
  return FALLBACK_GRAMMAR_UNITS
}

/**
 * Chọn Unit cho task ngữ pháp. Nếu không dùng được Unit AI chọn (sai mã / đã dùng),
 * ghi đè title + description theo Unit thực sự được gán để nội dung luôn khớp tài nguyên.
 */
export function resolveGrammarTask(opts: {
  units: GrammarCatalogUnit[]
  level: Level
  query: string
  preferredUnitId?: string | null
  usedUnits: Set<string>
}): {
  resource: RoadmapResourceMeta
  override?: { title: string; description: string; searchQuery: string }
} {
  const m = matchGrammarUnit(
    opts.units,
    opts.query,
    opts.level,
    opts.usedUnits,
    opts.preferredUnitId,
  )
  const resource: RoadmapResourceMeta = {
    kind: 'grammar',
    unitId: m.unitId,
    unitTitle: m.unitTitle,
    unitGroup: m.unitGroup,
  }
  if (m.matchedPreferred) return { resource }
  return {
    resource,
    override: {
      title: `Ngữ pháp Unit ${m.unitId}: ${m.unitTitle}`,
      description: `Đọc phần lý thuyết và làm bài tập của Unit ${m.unitId} (${m.unitGroup}) trong English Grammar in Use, sau đó tự đặt 3 câu của riêng bạn với cấu trúc vừa học.`,
      searchQuery: m.unitTitle,
    },
  }
}

async function resolveTaskResource(opts: {
  activityType: RoadmapActivityType
  level: Level
  topic: string
  searchQuery: string
  taskTitle?: string
  goal: string
  usedUrls: Set<string>
}): Promise<RoadmapResourceMeta | null> {
  const query = `${opts.searchQuery} ${opts.topic}`.trim()

  switch (opts.activityType) {
    case 'listening': {
      const isIelts = /ielts/i.test(opts.goal) || /ielts/i.test(query)
      const sources: ListeningSource[] = isIelts
        ? ['cambridge-listening', 'tactics', 'elllo', 'breaking-news']
        : ['tactics', 'elllo', 'breaking-news', 'ee-blog']

      const score = makeScorer(query)
      let globalBest: {
        source: ListeningSource
        url: string
        title: string
      } | null = null
      let globalBestScore = -1

      for (const src of sources) {
        try {
          const items = await listeningCatalog(src)
          const levelMatched = items.filter(
            (i) =>
              !opts.usedUrls.has(i.url) &&
              (i.levels.includes(opts.level) || src === 'cambridge-listening'),
          )
          const pool = levelMatched.length
            ? levelMatched
            : items.filter((i) => !opts.usedUrls.has(i.url))
          if (!pool.length) continue

          for (const item of pool) {
            const s = score(item.title)
            if (s > globalBestScore) {
              globalBestScore = s
              globalBest = {
                source: item.source,
                url: item.url,
                title: item.title,
              }
            }
          }
        } catch {
          continue
        }
      }

      if (globalBest) {
        opts.usedUrls.add(globalBest.url)
        return {
          kind: 'listening',
          source: globalBest.source,
          url: globalBest.url,
          itemTitle: globalBest.title,
        }
      }

      return {
        kind: 'listening',
        source: 'tactics',
        itemTitle: opts.taskTitle || opts.topic || opts.searchQuery,
      }
    }

    case 'reading': {
      const readingLevel: ReadingLevel =
        opts.level === 'A1' ? 'A2' : opts.level
      const isIelts = /ielts/i.test(opts.goal) || /ielts/i.test(query)
      const sources: LibrarySource[] = isIelts
        ? ['cambridge-ielts', 'essential', 'breaking-news']
        : ['essential', 'breaking-news', 'linguapress', 'onestop']

      const score = makeScorer(query)
      let globalBest: {
        source: LibrarySource
        url: string
        title: string
      } | null = null
      let globalBestScore = -1

      for (const src of sources) {
        try {
          const items = await libraryCatalog(src)
          const levelMatched = items.filter(
            (i) =>
              !opts.usedUrls.has(i.url) && i.levels.includes(readingLevel),
          )
          const pool = levelMatched.length
            ? levelMatched
            : items.filter((i) => !opts.usedUrls.has(i.url))
          if (!pool.length) continue

          for (const item of pool) {
            const s = score(item.title)
            if (s > globalBestScore) {
              globalBestScore = s
              globalBest = {
                source: item.source,
                url: item.url,
                title: item.title,
              }
            }
          }
        } catch {
          continue
        }
      }

      if (globalBest && globalBestScore >= 4) {
        opts.usedUrls.add(globalBest.url)
        return {
          kind: 'reading',
          source: globalBest.source,
          url: globalBest.url,
          itemTitle: globalBest.title,
        }
      }

      return {
        kind: 'reading',
        source: 'ai',
        itemTitle: opts.taskTitle || opts.topic || opts.searchQuery,
      }
    }

    case 'talk': {
      const score = makeScorer(query)
      let bestScenario = 'custom'
      let bestScore = 0
      for (const s of SCENARIOS) {
        const sc = score(`${s.id} ${s.label} ${s.detail} ${s.setup}`)
        if (sc > bestScore) {
          bestScore = sc
          bestScenario = s.id
        }
      }
      return {
        kind: 'talk',
        scenario: bestScore >= 2 ? bestScenario : 'custom',
        itemTitle: opts.topic || opts.searchQuery,
      }
    }

    case 'reflex': {
      const lower = `${opts.topic} ${opts.searchQuery}`.toLowerCase()
      const reflexMode = /situation|tình huống|role/i.test(lower)
        ? 'situation'
        : /question|qa|hỏi/i.test(lower)
          ? 'qa'
          : /pattern|mẫu câu/i.test(lower)
            ? 'pattern'
            : 'translate'
      return {
        kind: 'reflex',
        reflexMode,
        itemTitle: opts.topic || opts.searchQuery,
      }
    }

    case 'speaking': {
      const score = makeScorer(query)
      let bestTopic = SPEAKING_TOPICS[0]
      let bestScore = -1
      for (const t of SPEAKING_TOPICS) {
        const sc = score(`${t.title} ${t.group}`)
        if (sc > bestScore) {
          bestScore = sc
          bestTopic = t
        }
      }
      return {
        kind: 'speaking',
        unitId: bestTopic.id,
        itemTitle: bestTopic.title,
      }
    }

    case 'ipa': {
      const lower = query.toLowerCase()
      if (/pillar|trụ cột|stress|intonation|rhythm|trọng âm|ngữ điệu|nhịp điệu/i.test(lower)) {
        return {
          kind: 'ipa',
          soundId: 'shadowing',
          itemTitle: '4 trụ cột của Shadowing (Âm · Trọng âm · Ngữ điệu · Nhịp điệu)',
        }
      }
      const sound = IPA_SOUNDS.find((s) =>
        s.examples.some((ex) =>
          lower.includes(ex.replace(/[[\]]/g, '').toLowerCase()),
        ),
      )
      return {
        kind: 'ipa',
        soundId: sound?.id ?? 'shadowing',
        itemTitle: sound
          ? `Âm /${sound.symbol.us}/ — ${sound.tip}`
          : 'Bảng âm IPA & 4 trụ cột Shadowing',
      }
    }

    case 'chunks':
      return {
        kind: 'chunks',
        itemTitle: opts.searchQuery || opts.topic,
      }

    case 'flashcards':
      return {
        kind: 'flashcards',
        itemTitle: `Bộ thẻ từ vựng: ${opts.topic || opts.searchQuery || opts.taskTitle || ''}`.trim(),
      }

    default:
      return null
  }
}

function getTopUserMistakes() {
  const rows = db
    .select({
      type: mistakes.type,
      word: mistakes.word,
      count: mistakes.count,
    })
    .from(mistakes)
    .orderBy(desc(mistakes.count), desc(mistakes.lastSeenAt))
    .limit(30)
    .all()

  const grouped = new Map<string, { count: number; examples: string[] }>()
  for (const r of rows) {
    const cur = grouped.get(r.type) ?? { count: 0, examples: [] }
    cur.count += r.count
    if (cur.examples.length < 4 && !cur.examples.includes(r.word)) {
      cur.examples.push(r.word)
    }
    grouped.set(r.type, cur)
  }

  return [...grouped.entries()]
    .map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
}

function getLibraryVideosSummary() {
  return db
    .select({
      youtubeId: videos.youtubeId,
      title: videos.title,
      channel: videos.channel,
      thumbnail: videos.thumbnail,
      durationSec: videos.durationSec,
    })
    .from(videos)
    .orderBy(desc(videos.createdAt))
    .limit(40)
    .all()
}

type RawTask = RoadmapWeekDaysOutput['days'][number]['tasks'][number]

/** Khoá chống chạy trùng: cùng một tuần chỉ sinh một lượt tại một thời điểm */
const weekJobs = new Map<string, Promise<void>>()

function populateWeekTasks(
  opts: Parameters<typeof populateWeekTasksInner>[0],
): Promise<void> {
  const key = `${opts.roadmapId}:${opts.weekPlan.week}`
  const running = weekJobs.get(key)
  if (running) return running
  const job = populateWeekTasksInner(opts).finally(() => weekJobs.delete(key))
  weekJobs.set(key, job)
  return job
}

async function populateWeekTasksInner(opts: {
  roadmapId: number
  goal: string
  dailyMinutes: number
  focusSkills: RoadmapActivityType[]
  weekPlan: RoadmapWeekPlan
  totalWeeks: number
}) {
  const existingTasks = db
    .select({
      weekNumber: roadmapTasks.weekNumber,
      video: roadmapTasks.video,
      resource: roadmapTasks.resource,
    })
    .from(roadmapTasks)
    .where(eq(roadmapTasks.roadmapId, opts.roadmapId))
    .all()

  const usedUrls = new Set<string>()
  const usedYoutubeIds = new Set<string>()
  const usedGrammarUnits = new Set<string>()

  for (const t of existingTasks) {
    if (t.weekNumber === opts.weekPlan.week) continue
    if (t.video?.url) usedUrls.add(t.video.url)
    if (t.video?.youtubeId) usedYoutubeIds.add(t.video.youtubeId)
    if (t.resource?.url) usedUrls.add(t.resource.url)
    if (t.resource?.kind === 'grammar' && t.resource.unitId)
      usedGrammarUnits.add(t.resource.unitId)
  }

  // Bài ngữ pháp người dùng đã làm đúng nhiều thì không đề xuất lại
  const completedGrammar = db
    .select({
      unitId: grammarAnswers.unitId,
      correct: sql<number>`sum(${grammarAnswers.correct})`,
    })
    .from(grammarAnswers)
    .groupBy(grammarAnswers.unitId)
    .all()
  for (const g of completedGrammar) {
    if (g.correct >= 8) usedGrammarUnits.add(g.unitId)
  }

  const libraryVideos = getLibraryVideosSummary()
  const topMistakes = getTopUserMistakes()
  const weekLevel: Level = LEVELS.includes(opts.weekPlan.level as Level)
    ? (opts.weekPlan.level as Level)
    : 'B1'
  const hasGrammar = opts.focusSkills.includes('grammar')
  const grammarCatalog = hasGrammar ? await getGrammarUnitCatalog() : []
  const availableGrammarUnits = hasGrammar
    ? grammarUnitsForLevel(grammarCatalog, weekLevel, usedGrammarUnits)
    : undefined

  const generated: RoadmapWeekDaysOutput = await structured({
    feature: 'roadmap',
    system: ROADMAP_SYSTEM,
    prompt: roadmapWeekDaysPrompt({
      goal: opts.goal,
      dailyMinutes: opts.dailyMinutes,
      focusSkills: opts.focusSkills,
      weekPlan: {
        ...opts.weekPlan,
        totalWeeks: opts.totalWeeks,
      },
      existingVideos: libraryVideos,
      topMistakes,
      availableGrammarUnits,
    }),
    schema: RoadmapWeekDaysSchema,
  })

  const allowedSkills = new Set<string>(opts.focusSkills)
  const fallbackSkill = opts.focusSkills[0] ?? 'shadow'

  const flat: Array<{
    day: { dayNumber: number; dayTitle: string }
    raw: RawTask
    activityType: RoadmapActivityType
    level: Level
  }> = []
  for (const day of [...generated.days].sort(
    (a, b) => a.dayNumber - b.dayNumber,
  )) {
    for (const raw of day.tasks) {
      flat.push({
        day,
        raw,
        activityType: allowedSkills.has(raw.activityType)
          ? raw.activityType
          : fallbackSkill,
        level: LEVELS.includes(raw.level) ? raw.level : weekLevel,
      })
    }
  }

  // Pha 1: làm nóng cache mạng song song (yt-dlp, catalog nghe/đọc, ELLLO) để pha chọn bên dưới chạy trong bộ nhớ
  const videoTasks = flat.filter((t) => isVideoActivity(t.activityType))
  const levels = [...new Set(videoTasks.map((t) => t.level))]
  const ytQueries = [
    ...new Set(
      videoTasks
        .filter((t) => t.raw.preferredSource === 'youtube')
        .map((t) =>
          youtubeQueryFor({
            searchQuery: t.raw.searchQuery,
            topic: t.raw.topic,
            level: t.level,
          }),
        ),
    ),
  ]
  const warmups: Array<() => Promise<unknown>> = [
    ...levels.map((lv) => () => getEllloCandidates(lv).catch(() => null)),
    ...ytQueries.map((q) => () => searchYoutubeCached(q).catch(() => null)),
  ]
  if (flat.some((t) => t.activityType === 'listening')) {
    for (const src of ['cambridge-listening', 'tactics', 'elllo', 'breaking-news', 'ee-blog'] as const)
      warmups.push(() => listeningCatalog(src).catch(() => null))
  }
  if (flat.some((t) => t.activityType === 'reading')) {
    for (const src of ['cambridge-ielts', 'essential', 'breaking-news', 'linguapress', 'onestop'] as const)
      warmups.push(() => libraryCatalog(src).catch(() => null))
  }
  await mapLimit(warmups, 4, (fn) => fn())

  // Video cần YouTube vì ELLLO không đủ khớp: tìm song song theo nhóm, tối đa 4 yt-dlp cùng lúc
  await mapLimit(
    videoTasks.filter((t) => t.raw.preferredSource !== 'youtube'),
    4,
    async (t) => {
      const q = `${t.raw.searchQuery} ${t.raw.topic}`.trim()
      const ellloItems = await getEllloCandidates(t.level).catch(() => [])
      const score = makeScorer(q)
      if (ellloItems.some((i) => score(i.title) >= 4)) return
      await searchYoutubeCached(
        youtubeQueryFor({
          searchQuery: t.raw.searchQuery,
          topic: t.raw.topic,
          level: t.level,
        }),
      ).catch(() => null)
    },
  )

  // Pha 2: chọn tuần tự (để không trùng bài), toàn bộ đọc từ cache nên rất nhanh
  const rows: Array<typeof roadmapTasks.$inferInsert> = []
  const positions = new Map<number, number>()

  for (const { day, raw, activityType, level } of flat) {
    let video: RoadmapVideoMeta | null = null
    let resource: RoadmapResourceMeta | null = null
    let title = raw.title
    let description = raw.description
    let searchQuery = raw.searchQuery

    if (isVideoActivity(activityType)) {
      video = await resolveTaskVideo({
        level,
        topic: raw.topic,
        searchQuery: raw.searchQuery,
        preferredSource: raw.preferredSource,
        existingVideoId: raw.existingVideoId,
        libraryVideos,
        usedUrls,
        usedYoutubeIds,
      })
    } else if (activityType === 'grammar') {
      const g = resolveGrammarTask({
        units: grammarCatalog.length ? grammarCatalog : FALLBACK_GRAMMAR_UNITS,
        level,
        query: `${raw.searchQuery} ${raw.topic} ${raw.title}`.trim(),
        preferredUnitId: raw.grammarUnitId,
        usedUnits: usedGrammarUnits,
      })
      resource = g.resource
      if (g.override) {
        title = g.override.title
        description = g.override.description
        searchQuery = g.override.searchQuery
      }
    } else {
      resource = await resolveTaskResource({
        activityType,
        level,
        topic: raw.topic,
        searchQuery: raw.searchQuery,
        taskTitle: raw.title,
        goal: opts.goal,
        usedUrls,
      })
    }

    const pos = (positions.get(day.dayNumber) ?? 0) + 1
    positions.set(day.dayNumber, pos)
    rows.push({
      roadmapId: opts.roadmapId,
      weekNumber: opts.weekPlan.week,
      dayNumber: day.dayNumber,
      dayTitle: day.dayTitle,
      position: pos,
      activityType,
      title,
      description,
      durationMinutes: raw.durationMinutes,
      level,
      topic: raw.topic,
      searchQuery,
      preferredSource: raw.preferredSource,
      video,
      resource,
    })
  }

  // Ghi một lần trong transaction: lỗi giữa chừng không để lại tuần nửa vời, UI không thấy tuần trống
  db.transaction((tx) => {
    tx.delete(roadmapTasks)
      .where(
        and(
          eq(roadmapTasks.roadmapId, opts.roadmapId),
          eq(roadmapTasks.weekNumber, opts.weekPlan.week),
        ),
      )
      .run()
    if (rows.length) tx.insert(roadmapTasks).values(rows).run()
  })
}

export const listRoadmaps = createServerFn({ method: 'GET' }).handler(
  async () => {
    const rows = db
      .select()
      .from(roadmaps)
      .orderBy(desc(roadmaps.createdAt))
      .all()

    const counts = db
      .select({
        roadmapId: roadmapTasks.roadmapId,
        total: sql<number>`count(*)`,
        done: sql<number>`sum(case when ${roadmapTasks.completedAt} is not null then 1 else 0 end)`,
      })
      .from(roadmapTasks)
      .groupBy(roadmapTasks.roadmapId)
      .all()

    const countMap = new Map(counts.map((c) => [c.roadmapId, c]))

    return rows.map((r) => {
      const stat = countMap.get(r.id)
      return {
        ...r,
        generatedTasks: stat?.total ?? 0,
        completedTasks: stat?.done ?? 0,
      }
    })
  },
)

export type RoadmapSummaryItem = Awaited<ReturnType<typeof listRoadmaps>>[number]

export const getRoadmap = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const roadmap = db
      .select()
      .from(roadmaps)
      .where(eq(roadmaps.id, data.id))
      .get()
    if (!roadmap) throw new Error('Không tìm thấy lộ trình học')

    const tasks = db
      .select()
      .from(roadmapTasks)
      .where(eq(roadmapTasks.roadmapId, roadmap.id))
      .orderBy(
        asc(roadmapTasks.weekNumber),
        asc(roadmapTasks.dayNumber),
        asc(roadmapTasks.position),
      )
      .all()

    // Kiểm tra những video nào hiện đã được import vào thư viện
    const ytIds = [
      ...new Set(
        tasks.flatMap((t) => (t.video?.youtubeId ? [t.video.youtubeId] : [])),
      ),
    ]
    const importedIds = new Set(
      ytIds.length
        ? db
            .select({ youtubeId: videos.youtubeId })
            .from(videos)
            .where(inArray(videos.youtubeId, ytIds))
            .all()
            .map((v) => v.youtubeId)
        : [],
    )

    const enrichedTasks: Array<RoadmapTask & { videoImported: boolean }> =
      tasks.map((t) => ({
        ...t,
        videoImported: Boolean(
          t.video?.source === 'library' ||
            (t.video?.youtubeId && importedIds.has(t.video.youtubeId)),
        ),
      }))

    return {
      roadmap,
      tasks: enrichedTasks,
    }
  })

export type RoadmapDetail = Awaited<ReturnType<typeof getRoadmap>>

export const createRoadmap = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      goal: z.string().trim().min(5).max(600),
      currentLevel: z.enum(LEVELS),
      targetLevel: z.enum(LEVELS),
      durationMonths: z.number().int().min(1).max(12),
      totalWeeks: z.number().int().min(1).max(52).optional(),
      dailyMinutes: z.number().int().min(10).max(180),
      focusSkills: z.array(z.enum(ROADMAP_ACTIVITY_TYPES)).min(1),
    }),
  )
  .handler(async ({ data }) => {
    const totalWeeks = data.totalWeeks ?? data.durationMonths * 4
    const topMistakes = getTopUserMistakes()

    const overview = await structured({
      feature: 'roadmap',
      system: ROADMAP_SYSTEM,
      prompt: roadmapOverviewPrompt({
        goal: data.goal,
        currentLevel: data.currentLevel,
        targetLevel: data.targetLevel,
        durationMonths: data.durationMonths,
        totalWeeks,
        dailyMinutes: data.dailyMinutes,
        focusSkills: data.focusSkills,
        topMistakes,
      }),
      schema: RoadmapOverviewSchema,
    })

    const phases = normalizePhases(overview.phases, totalWeeks)
    const normalizedWeeks = normalizeRoadmapWeeks({
      weeks: expandPhasesToWeeks({
        phases,
        currentLevel: data.currentLevel,
        focusSkills: data.focusSkills,
      }),
      phases,
      totalWeeks,
      currentLevel: data.currentLevel,
      targetLevel: data.targetLevel,
      focusSkills: data.focusSkills,
    })

    const inserted = db
      .insert(roadmaps)
      .values({
        title: overview.title,
        goal: data.goal,
        currentLevel: data.currentLevel,
        targetLevel: data.targetLevel,
        durationMonths: data.durationMonths,
        totalWeeks,
        dailyMinutes: data.dailyMinutes,
        focusSkills: data.focusSkills,
        summary: overview.summary,
        phases: phases.map(
          ({ index, title, weeks, targetLevel, focus, milestones }) => ({
            index,
            title,
            weeks,
            targetLevel,
            focus,
            milestones,
          }),
        ),
        weeks: normalizedWeeks,
      })
      .returning({ id: roadmaps.id })
      .get()

    // Trả về ngay; chi tiết Tuần 1 được sinh ở trang lộ trình (generateRoadmapWeek) để người dùng không phải chờ 2 lượt AI + tìm video
    return { id: inserted.id }
  })

export const generateRoadmapWeek = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      roadmapId: z.number().int().positive(),
      weekNumber: z.number().int().min(1).max(52),
    }),
  )
  .handler(async ({ data }) => {
    const roadmap = db
      .select()
      .from(roadmaps)
      .where(eq(roadmaps.id, data.roadmapId))
      .get()
    if (!roadmap) throw new Error('Không tìm thấy lộ trình học')

    const weekPlan =
      roadmap.weeks.find((w) => w.week === data.weekNumber) ??
      roadmap.weeks.at(data.weekNumber - 1)
    if (!weekPlan) throw new Error(`Không tìm thấy kế hoạch tuần ${data.weekNumber}`)

    await populateWeekTasks({
      roadmapId: roadmap.id,
      goal: roadmap.goal,
      dailyMinutes: roadmap.dailyMinutes,
      focusSkills: roadmap.focusSkills as RoadmapActivityType[],
      weekPlan,
      totalWeeks: roadmap.totalWeeks,
    })

    return { ok: true }
  })

export const swapTaskVideo = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      taskId: z.number().int().positive(),
      preferSource: z.enum(['elllo', 'youtube']).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const task = db
      .select()
      .from(roadmapTasks)
      .where(eq(roadmapTasks.id, data.taskId))
      .get()
    if (!task) throw new Error('Không tìm thấy nhiệm vụ')

    const siblingTasks = db
      .select()
      .from(roadmapTasks)
      .where(eq(roadmapTasks.roadmapId, task.roadmapId))
      .all()

    const usedUrls = new Set<string>()
    const usedYoutubeIds = new Set<string>()
    for (const s of siblingTasks) {
      if (s.video?.url) usedUrls.add(s.video.url)
      if (s.video?.youtubeId) usedYoutubeIds.add(s.video.youtubeId)
    }

    const nextSource =
      data.preferSource ??
      (task.video?.source === 'elllo' ? 'youtube' : 'elllo')

    const nextVideo = await resolveTaskVideo({
      level: (LEVELS.includes(task.level as Level)
        ? task.level
        : 'B1') as Level,
      topic: task.topic ?? task.title,
      searchQuery: task.searchQuery ?? task.topic ?? task.title,
      preferredSource: nextSource,
      libraryVideos: getLibraryVideosSummary(),
      usedUrls,
      usedYoutubeIds,
      skipLibrary: true,
    })

    if (!nextVideo) {
      throw new Error('Không tìm thấy video thay thế khác phù hợp, hãy thử lại.')
    }

    db.update(roadmapTasks)
      .set({ video: nextVideo })
      .where(eq(roadmapTasks.id, task.id))
      .run()

    return { video: nextVideo }
  })

export const toggleRoadmapTask = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      taskId: z.number().int().positive(),
      completed: z.boolean(),
    }),
  )
  .handler(async ({ data }) => {
    const completedAt = data.completed ? new Date() : null
    db.update(roadmapTasks)
      .set({ completedAt })
      .where(eq(roadmapTasks.id, data.taskId))
      .run()
    return { ok: true, completedAt }
  })

export const deleteRoadmap = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(async ({ data }) => {
    db.delete(roadmaps).where(eq(roadmaps.id, data.id)).run()
    return { ok: true }
  })

/**
 * Nhiệm vụ Thẻ từ: tạo (một lần) bộ thẻ từ vựng đúng chủ đề của nhiệm vụ rồi trả deckId để học,
 * thay vì mở hàng đợi ôn chung gồm các từ cũ không liên quan.
 */
export const openTaskDeck = createServerFn({ method: 'POST' })
  .validator(z.object({ taskId: z.number().int().positive() }))
  .handler(async ({ data }) => {
    const task = db
      .select()
      .from(roadmapTasks)
      .where(eq(roadmapTasks.id, data.taskId))
      .get()
    if (!task) throw new Error('Không tìm thấy nhiệm vụ')

    const exists = (id: number) =>
      db
        .select({ n: sql<number>`count(${cards.id})` })
        .from(cards)
        .where(eq(cards.deckId, id))
        .get()?.n

    const savedId = task.resource?.deckId
    if (savedId && exists(savedId)) return { deckId: savedId }

    const topic = (task.topic || task.searchQuery || task.title).trim()
    const level = LEVELS.includes(task.level as Level) ? task.level : 'B1'
    const ref = `roadmap:${topic.toLowerCase().replace(/\s+/g, '-').slice(0, 80)}:${level}`

    // cùng chủ đề + cấp độ ở tuần khác thì dùng lại bộ đã có
    const reuse = db.select({ id: decks.id }).from(decks).where(eq(decks.ref, ref)).get()
    let deckId = reuse?.id
    if (!deckId || !exists(deckId)) {
      const roadmap = db
        .select({ goal: roadmaps.goal })
        .from(roadmaps)
        .where(eq(roadmaps.id, task.roadmapId))
        .get()
      const out = await structured({
        feature: 'roadmap',
        system: TOPIC_VOCAB_SYSTEM,
        prompt: topicVocabPrompt({ topic, level, goal: roadmap?.goal }),
        schema: TopicVocabSchema,
      })
      deckId = db.transaction((tx) => {
        const id =
          reuse?.id ??
          tx
            .insert(decks)
            .values({ name: `Lộ trình · ${topic} (${level})`, source: 'custom', ref })
            .returning({ id: decks.id })
            .get().id
        const seen = new Set<string>()
        const rows = out.words
          .filter((w) => {
            const k = w.word.trim().toLowerCase()
            if (!k || seen.has(k)) return false
            seen.add(k)
            return true
          })
          .map((w) => ({
            deckId: id,
            front: w.word.trim(),
            back: w.meaningVi.trim(),
            ipa: w.ipa.replace(/^\/|\/$/g, '').trim() || null,
            example: `${w.exampleEn.trim()}\n${w.exampleVi.trim()}`,
          }))
        if (rows.length) tx.insert(cards).values(rows).run()
        return id
      })
    }

    db.update(roadmapTasks)
      .set({
        resource: {
          ...(task.resource ?? { kind: 'flashcards' as const }),
          kind: 'flashcards',
          deckId,
        },
      })
      .where(eq(roadmapTasks.id, task.id))
      .run()

    return { deckId }
  })
