import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

import seed from '#/chunks-data/chunks.seed.json'
import { CHUNK_SOURCES } from '#/chunks-data/chunk-sources.ts'
import { db } from '#/db/index.ts'
import { cards, decks, userChunkImports, userChunks } from '#/db/schema.ts'
import type { CardInfo } from '#/db/schema.ts'
import { createChunkMatcher } from '#/lib/chunk-match.ts'
import { CHUNK_KINDS, CHUNK_LEVELS, CHUNK_TOPICS } from '#/lib/chunks.ts'
import type { ChunkKind, ChunkLevel, ChunkSeed } from '#/lib/chunks.ts'
import {
  TOPIC_CHUNKS_SYSTEM,
  TopicChunksSchema,
  topicChunksPrompt,
} from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import {
  MAX_PAGES,
  STALE_MS,
  countUserChunks,
  readDocument,
  runUserChunkImport,
} from '../chunks/user-import.ts'

const chunks = seed as ChunkSeed[]
const byId = new Map(chunks.map((chunk) => [chunk.id, chunk]))

const Filters = z.object({
  level: z.enum(CHUNK_LEVELS).optional(),
  topic: z.enum(CHUNK_TOPICS).optional(),
  kind: z.enum(CHUNK_KINDS).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.number().int().min(1).default(1),
})

const PAGE_SIZE = 50

/** bộ thẻ "Chunks": tạo khi lưu chunk đầu tiên, ref cố định để không tạo trùng */
const CHUNK_DECK_REF = 'chunks:default'
const chunkDeckId = (create: boolean) =>
  db
    .select({ id: decks.id })
    .from(decks)
    .where(eq(decks.ref, CHUNK_DECK_REF))
    .get()?.id ??
  (create
    ? db
        .insert(decks)
        .values({ name: 'Chunks', source: 'chunks', ref: CHUNK_DECK_REF })
        .returning({ id: decks.id })
        .get().id
    : null)

/** chunk (chữ thường) đã có thẻ trong bộ Chunks */
function savedTexts(texts: string[]) {
  const deckId = chunkDeckId(false)
  if (!deckId || !texts.length) return new Set<string>()
  const lower = texts.map((t) => t.toLowerCase())
  return new Set(
    db
      .select({ front: sql<string>`lower(${cards.front})` })
      .from(cards)
      .where(
        and(
          eq(cards.deckId, deckId),
          inArray(sql`lower(${cards.front})`, lower),
        ),
      )
      .all()
      .map((r) => r.front),
  )
}

const TOPIC_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'in',
  'at',
  'on',
  'to',
  'for',
  'of',
  'with',
  'and',
  'or',
  'about',
  'my',
  'your',
  'our',
  'their',
  'describing',
  'describe',
  'talking',
  'talk',
  'asking',
  'ask',
  'giving',
  'give',
  'using',
  'use',
  'phrases',
  'phrase',
  'expressions',
  'expression',
  'vocabulary',
  'words',
  'conversation',
  'english',
  'practice',
])

function extractQueryKeywords(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[\s,.;:!?()[\]"'/\\–—-]+/)
    .filter((w) => w.length >= 3 && !TOPIC_STOPWORDS.has(w))
}

function aiTopicFileName(topic: string, level: ChunkLevel): string {
  const clean = topic.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 120)
  return `ai-topic:${level}:${clean}`
}

function loadCachedTopicChunks(topic: string, level: ChunkLevel) {
  const fileName = aiTopicFileName(topic, level)
  const imp = db
    .select()
    .from(userChunkImports)
    .where(eq(userChunkImports.fileName, fileName))
    .get()
  if (!imp) return null

  const rows = db
    .select()
    .from(userChunks)
    .where(eq(userChunks.importId, imp.id))
    .orderBy(userChunks.id)
    .all()
  if (!rows.length) return null

  const saved = savedTexts(rows.map((r) => r.text))
  return {
    importId: imp.id,
    label: imp.label,
    level,
    topic: topic.trim(),
    items: rows.map((r) => ({
      ...r,
      label: imp.label,
      saved: saved.has(r.text.toLowerCase()),
    })),
  }
}

/** Kho seed source-only offline; lọc và phân trang trên server để không gửi toàn bộ dữ liệu xuống client. */
export const listChunks = createServerFn({ method: 'GET' })
  .validator(Filters)
  .handler(async ({ data }) => {
    const needle = data.q?.toLocaleLowerCase('en') ?? ''
    const basePool = chunks.filter(
      (chunk) =>
        (!data.level || chunk.level === data.level) &&
        (!data.topic || chunk.topic === data.topic) &&
        (!data.kind || chunk.kind === data.kind),
    )

    let filtered = !needle
      ? basePool
      : basePool.filter(
          (chunk) =>
            chunk.text.toLocaleLowerCase('en').includes(needle) ||
            chunk.exampleEn.toLocaleLowerCase('en').includes(needle) ||
            (chunk.meaningVi ?? chunk.exampleVi)
              .toLocaleLowerCase('vi')
              .includes(needle) ||
            chunk.definitionEn?.toLocaleLowerCase('en').includes(needle),
        )

    const exactMatchCount = filtered.length

    // Nếu người học tìm theo cụm chủ đề nhiều từ (vd. "describing apartment", "talking about hometown")
    // mà khớp chính xác nguyên cụm = 0, tự động tách từ khoá chính để gợi ý các chunk liên quan trong kho seed
    if (needle && filtered.length === 0) {
      const keywords = extractQueryKeywords(needle)
      if (keywords.length > 0) {
        const scored: Array<{ chunk: ChunkSeed; score: number }> = []
        for (const chunk of basePool) {
          const hay = `${chunk.text} ${chunk.exampleEn} ${chunk.meaningVi ?? ''} ${chunk.exampleVi} ${chunk.definitionEn ?? ''}`.toLowerCase()
          let score = 0
          for (const kw of keywords) {
            if (hay.includes(kw)) score++
          }
          if (score > 0) scored.push({ chunk, score })
        }
        scored.sort((a, b) => b.score - a.score)
        filtered = scored.map((s) => s.chunk)
      }
    }

    const offset = (data.page - 1) * PAGE_SIZE
    const items = filtered.slice(offset, offset + PAGE_SIZE)
    const saved = savedTexts(items.map((c) => c.text))
    const aiTopic = data.q?.trim()
      ? loadCachedTopicChunks(data.q.trim(), data.level ?? 'B1')
      : null

    return {
      items,
      saved: items
        .filter((c) => saved.has(c.text.toLowerCase()))
        .map((c) => c.id),
      total: filtered.length,
      exactMatchCount,
      aiTopic,
      page: data.page,
      pageSize: PAGE_SIZE,
      pages: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
      levelCounts: Object.fromEntries(
        CHUNK_LEVELS.map((level) => [
          level,
          chunks.filter((chunk) => chunk.level === level).length,
        ]),
      ),
      kindCounts: Object.fromEntries(
        CHUNK_KINDS.map((kind) => [
          kind,
          chunks.filter((chunk) => chunk.kind === kind).length,
        ]),
      ),
    }
  })

export type ChunkListResult = Awaited<ReturnType<typeof listChunks>>

/** Sinh bộ Chunks theo chủ đề và cấp độ bằng AI, lưu vào user_chunks để nghe, nói theo và lưu thẻ SRS */
export const generateTopicChunks = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      topic: z.string().trim().min(2).max(160),
      level: z.enum(CHUNK_LEVELS).default('B1'),
      forceRegenerate: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    if (!data.forceRegenerate) {
      const cached = loadCachedTopicChunks(data.topic, data.level)
      if (cached) return cached
    }

    const generated = await structured({
      feature: 'chunks',
      system: TOPIC_CHUNKS_SYSTEM,
      prompt: topicChunksPrompt({
        topic: data.topic,
        level: data.level,
      }),
      schema: TopicChunksSchema,
    })

    const fileName = aiTopicFileName(data.topic, data.level)
    const label = `AI Chunks · ${data.topic} (${data.level})`

    const existingImp = db
      .select()
      .from(userChunkImports)
      .where(eq(userChunkImports.fileName, fileName))
      .get()

    let importId: number
    if (existingImp) {
      importId = existingImp.id
      db.delete(userChunks).where(eq(userChunks.importId, importId)).run()
      db.update(userChunkImports)
        .set({
          label: label.slice(0, 200),
          status: 'done',
          pages: 1,
          donePages: 1,
          error: null,
          updatedAt: new Date(),
        })
        .where(eq(userChunkImports.id, importId))
        .run()
    } else {
      importId = db
        .insert(userChunkImports)
        .values({
          label: label.slice(0, 200),
          fileName: fileName.slice(0, 200),
          status: 'done',
          pages: 1,
          donePages: 1,
        })
        .returning({ id: userChunkImports.id })
        .get().id
    }

    const seen = new Set<string>()
    for (const item of generated.chunks) {
      const text = item.text.trim()
      const normalizedText = text.toLowerCase().replace(/\s+/g, ' ')
      if (!text || seen.has(normalizedText)) continue
      seen.add(normalizedText)

      const exEn = item.exampleEn.trim()
      const exVi = item.exampleVi.trim()
      const exampleCombined = exEn
        ? exVi
          ? `${exEn}\n${exVi}`
          : exEn
        : null

      db.insert(userChunks)
        .values({
          importId,
          text,
          normalizedText,
          meaningVi: item.meaningVi.trim(),
          exampleEn: exampleCombined,
          kind: item.kind,
          page: null,
        })
        .run()
    }

    const loaded = loadCachedTopicChunks(data.topic, data.level)
    if (!loaded) {
      throw new Error('Không tạo được danh sách chunks từ AI, hãy thử lại.')
    }
    return loaded
  })

export type AiTopicChunksResult = Awaited<ReturnType<typeof generateTopicChunks>>

/** Danh mục giấy phép hiển thị ở trang attribution. */
export const listChunkSources = createServerFn({ method: 'GET' }).handler(
  async () => CHUNK_SOURCES,
)

/* ---------- lưu chunk thành thẻ ôn SRS ---------- */

export const saveChunkCard = createServerFn({ method: 'POST' })
  .validator(
    z.union([
      z.object({ chunkId: z.string().min(1).max(200) }),
      z.object({ userChunkId: z.number().int() }),
    ]),
  )
  .handler(async ({ data }) => {
    let card: {
      front: string
      back: string
      example: string | null
      meaningVi: string | null
      audioUrl: string | null
      info: CardInfo | null
    }
    if ('chunkId' in data) {
      const chunk = byId.get(data.chunkId)
      if (!chunk) throw new Error('Không tìm thấy chunk')
      const examples = chunk.examples.length
        ? chunk.examples.map((e) => ({
            en: e.en,
            vi: e.vi,
            src: `https://tatoeba.org/en/sentences/show/${e.enId}`,
          }))
        : [{ en: chunk.exampleEn, vi: chunk.exampleVi }]
      card = {
        front: chunk.text,
        back: chunk.meaningVi ?? chunk.definitionEn ?? chunk.exampleVi,
        example:
          chunk.exampleEn === chunk.text
            ? null
            : `${chunk.exampleEn}\n${chunk.exampleVi}`,
        meaningVi: chunk.meaningVi,
        audioUrl: chunk.audioUrl,
        info: {
          pos: null,
          examples,
          collocations: [],
          idioms: [],
          family: [],
          synonyms: [],
        },
      }
    } else {
      const row = db
        .select()
        .from(userChunks)
        .where(eq(userChunks.id, data.userChunkId))
        .get()
      if (!row) throw new Error('Không tìm thấy chunk')
      const lines = row.exampleEn?.split('\n') ?? []
      const exEn = lines[0]?.trim() ?? ''
      const exVi = lines[1]?.trim() ?? ''
      card = {
        front: row.text,
        back: row.meaningVi ?? '',
        example: row.exampleEn,
        meaningVi: row.meaningVi,
        audioUrl: null,
        info: exEn
          ? {
              pos: null,
              examples: [{ en: exEn, vi: exVi }],
              collocations: [],
              idioms: [],
              family: [],
              synonyms: [],
            }
          : null,
      }
    }
    const deckId = chunkDeckId(true)
    if (deckId === null) throw new Error('Không tạo được bộ thẻ Chunks')
    const existing = db
      .select({ id: cards.id })
      .from(cards)
      .where(
        and(
          eq(cards.deckId, deckId),
          sql`lower(${cards.front}) = ${card.front.toLowerCase()}`,
        ),
      )
      .get()
    if (existing) return { cardId: existing.id, deckId, created: false }
    const inserted = db
      .insert(cards)
      .values({ deckId, ...card })
      .returning({ id: cards.id })
      .get()
    return { cardId: inserted.id, deckId, created: true }
  })

/* ---------- nhận diện chunk trong bài đọc / bài nghe / phụ đề ---------- */

/** cụm ngắn trong seed (không tính câu Tatoeba nguyên câu) */
const seedMatcher = createChunkMatcher(
  chunks.flatMap((chunk) => chunk.forms.map((form) => [form, chunk] as const)),
)

export interface DetectedChunk {
  key: string
  text: string
  surface: string
  kind: ChunkKind
  level: string | null
  meaningVi: string | null
  definitionEn: string | null
  exampleEn: string | null
  exampleVi: string | null
  audioUrl: string | null
  chunkId: string | null
  userChunkId: number | null
  saved: boolean
}

export const detectChunks = createServerFn({ method: 'POST' })
  .validator(z.object({ text: z.string().max(60_000) }))
  .handler(async ({ data }): Promise<DetectedChunk[]> => {
    const own = db.select().from(userChunks).all()
    const userMatcher = createChunkMatcher(
      own.map((row) => [row.normalizedText, row] as const),
    )
    const found: DetectedChunk[] = [
      ...userMatcher.find(data.text).map(({ item, surface }) => ({
        key: `user:${item.id}`,
        text: item.text,
        surface,
        kind: item.kind as ChunkKind,
        level: null,
        meaningVi: item.meaningVi,
        definitionEn: null,
        exampleEn: item.exampleEn,
        exampleVi: null,
        audioUrl: null,
        chunkId: null,
        userChunkId: item.id,
        saved: false,
      })),
      ...seedMatcher.find(data.text).map(({ item, surface }) => ({
        key: `seed:${item.id}`,
        text: item.text,
        surface,
        kind: item.kind,
        level: item.level,
        meaningVi: item.meaningVi,
        definitionEn: item.definitionEn,
        exampleEn: item.exampleEn,
        exampleVi: item.exampleVi,
        audioUrl: item.audioUrl,
        chunkId: item.id,
        userChunkId: null,
        saved: false,
      })),
    ]
    // cùng một cụm có ở cả hai nơi: giữ bản của người dùng
    const unique = new Map<string, DetectedChunk>()
    for (const chunk of found) {
      const k = chunk.text.toLowerCase()
      if (!unique.has(k)) unique.set(k, chunk)
    }
    const list = [...unique.values()]
    const saved = savedTexts(list.map((c) => c.text))
    return list.map((c) => ({ ...c, saved: saved.has(c.text.toLowerCase()) }))
  })

/* ---------- chunk từ tài liệu của người dùng ---------- */

const MAX_FILE_BYTES = 40 * 1024 * 1024

export const importUserChunks = createServerFn({ method: 'POST' })
  .validator((form: FormData) => {
    if (!(form instanceof FormData)) throw new Error('Dữ liệu không hợp lệ')
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0)
      throw new Error('Hãy chọn tệp PDF hoặc văn bản')
    if (file.size > MAX_FILE_BYTES) throw new Error('Tệp quá lớn (tối đa 40MB)')
    const label = form.get('label')
    return {
      file,
      label:
        (typeof label === 'string' && label.trim()) ||
        file.name.replace(/\.[^.]+$/, ''),
    }
  })
  .handler(async ({ data }) => {
    const pages = await readDocument(data.file)
    if (!pages.some((p) => p.trim()))
      throw new Error(
        'Không đọc được chữ trong tệp (PDF scan dạng ảnh chưa được hỗ trợ)',
      )
    if (pages.length > MAX_PAGES)
      throw new Error(`Tài liệu quá dài (tối đa ${MAX_PAGES} trang)`)
    const row = db
      .insert(userChunkImports)
      .values({
        label: data.label.slice(0, 200),
        fileName: data.file.name.slice(0, 200),
        pages: pages.length,
      })
      .returning({ id: userChunkImports.id })
      .get()
    void runUserChunkImport(row.id, pages)
    return { id: row.id }
  })

export const listUserChunkImports = createServerFn({ method: 'GET' }).handler(
  async () =>
    db
      .select()
      .from(userChunkImports)
      .orderBy(desc(userChunkImports.id))
      .all()
      .map((row) => {
        const stale =
          (row.status === 'running' || row.status === 'queued') &&
          Date.now() - row.updatedAt.getTime() > STALE_MS
        return {
          ...row,
          status: stale ? 'error' : row.status,
          error: stale
            ? 'Bị gián đoạn (ứng dụng đã khởi động lại). Hãy xoá và nhập lại.'
            : row.error,
          chunks: countUserChunks(row.id),
        }
      }),
)

export const listUserChunks = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      importId: z.number().int().optional(),
      q: z.string().trim().max(100).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const rows = db
      .select({
        chunk: userChunks,
        label: userChunkImports.label,
      })
      .from(userChunks)
      .innerJoin(userChunkImports, eq(userChunks.importId, userChunkImports.id))
      .where(data.importId ? eq(userChunks.importId, data.importId) : undefined)
      .orderBy(userChunks.importId, userChunks.page, userChunks.id)
      .all()
    const needle = data.q?.toLowerCase()
    const list = rows
      .map((r) => ({ ...r.chunk, label: r.label }))
      .filter(
        (r) =>
          !needle ||
          r.text.toLowerCase().includes(needle) ||
          r.meaningVi?.toLowerCase().includes(needle),
      )
    const saved = savedTexts(list.map((r) => r.text))
    return list.map((r) => ({ ...r, saved: saved.has(r.text.toLowerCase()) }))
  })

export type UserChunkRow = Awaited<ReturnType<typeof listUserChunks>>[number]

export const deleteUserChunkImport = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    db.delete(userChunkImports).where(eq(userChunkImports.id, data.id)).run()
    return { ok: true }
  })

export const deleteUserChunk = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    db.delete(userChunks).where(eq(userChunks.id, data.id)).run()
    return { ok: true }
  })
