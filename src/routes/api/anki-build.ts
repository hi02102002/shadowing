import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { buildGeneratedApkg } from '#/server/anki-builder-build'
import type { AnyAnkiCard } from '#/lib/anki-builder'

const str = z.string().optional().default('')

const vocabCard = z.object({
  type: z.literal('vocabulary').optional().default('vocabulary'),
  selected: z.boolean(),
  unitNumber: z.number().optional(),
  kind: z.enum(['word', 'phrase']).optional(),
  partOfSpeech: str,
  hint: z.string().optional(),
  word: z.string(),
  ipa: str,
  vietnamese: str,
  englishDefinition: str,
  example: str,
  imageQuery: str,
  imageUrl: str,
  wordAudioUrl: str,
  exampleAudioUrl: str,
  chunks: z
    .array(
      z.object({
        text: z.string(),
        ipa: str,
        meaningVi: str,
        englishDefinition: str,
        example: str,
        imageQuery: str,
        imageUrl: str,
        partOfSpeech: str,
        audioUrl: str,
        exampleAudioUrl: str,
      }),
    )
    .optional()
    .default([]),
})

const noteCard = z.object({
  type: z.literal('note'),
  selected: z.boolean(),
  unitNumber: z.number().optional(),
  title: z.string(),
  content: z.array(z.string()),
  vietnameseExplanation: str,
  example: str,
  exampleAudioUrl: str,
})

const payload = z.object({
  deckName: z.string().min(1).max(200),
  cards: z
    .array(z.union([noteCard, vocabCard]))
    .min(1)
    .max(1000),
})

interface Job {
  deckName: string
  status: 'processing' | 'completed' | 'error'
  total: number
  processed: number
  createdAt: number
  data?: Uint8Array
  error?: string
}

// tải ảnh/audio cho cả trăm thẻ mất cả phút → chạy nền, client hỏi tiến độ rồi tải file
const jobs = new Map<string, Job>()
const JOB_TTL_MS = 15 * 60 * 1000

const filenameFor = (name: string) =>
  `${
    name
      .replace(/::/g, ' - ')
      .replace(/[^\w\s.-]/g, '')
      .trim() || 'anki-deck'
  }.apkg`

/** Tạo gói .apkg từ thẻ của trình tạo Anki: POST {deckName, cards} → {jobId}; GET ?jobId= → tiến độ; GET ?jobId=&download=1 → file */
export const Route = createFileRoute('/api/anki-build')({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url)
        const job = jobs.get(url.searchParams.get('jobId') ?? '')
        if (!job)
          return Response.json(
            { error: 'Không thấy tác vụ xuất (hết hạn?)' },
            { status: 404 },
          )
        if (url.searchParams.get('download') === '1') {
          if (job.status !== 'completed' || !job.data)
            return Response.json(
              { error: 'File chưa sẵn sàng' },
              { status: 400 },
            )
          return new Response(job.data as BodyInit, {
            headers: {
              'content-type': 'application/octet-stream',
              'content-disposition': `attachment; filename="deck.apkg"; filename*=UTF-8''${encodeURIComponent(filenameFor(job.deckName))}`,
              'cache-control': 'no-store',
            },
          })
        }
        return Response.json({
          status: job.status,
          processed: job.processed,
          total: job.total,
          error: job.error,
        })
      },
      POST: async ({ request }) => {
        const parsed = payload.safeParse(await request.json().catch(() => null))
        if (!parsed.success) {
          return Response.json(
            {
              error: parsed.error.issues
                .map((i) => `${i.path.join('.')}: ${i.message}`)
                .join('; '),
            },
            { status: 400 },
          )
        }
        const cards = parsed.data.cards.filter(
          (c) => c.selected,
        ) as AnyAnkiCard[]
        if (!cards.length)
          return Response.json({ error: 'Chưa chọn thẻ nào' }, { status: 400 })

        const now = Date.now()
        for (const [id, j] of jobs)
          if (now - j.createdAt > JOB_TTL_MS) jobs.delete(id)
        const id = randomUUID()
        const job: Job = {
          deckName: parsed.data.deckName,
          status: 'processing',
          total: cards.length,
          processed: 0,
          createdAt: now,
        }
        jobs.set(id, job)
        buildGeneratedApkg(
          job.deckName,
          cards,
          (done) => (job.processed = done),
        )
          .then((data) => {
            job.data = data
            job.processed = job.total
            job.status = 'completed'
          })
          .catch((err: unknown) => {
            job.status = 'error'
            job.error =
              err instanceof Error ? err.message : 'Xuất file Anki thất bại'
          })
        return Response.json({ jobId: id, total: cards.length })
      },
    },
  },
})
