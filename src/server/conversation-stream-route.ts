import { defineHandler } from 'nitro/h3'
import { asc, eq } from 'drizzle-orm'

import { db } from '#/db/index.ts'
import { conversations, conversationTurns } from '#/db/schema.ts'
import { MAX_USER_TURNS } from '#/lib/conversation.ts'
import type { TalkLevel } from '#/lib/conversation.ts'
import { conversationPrompt, conversationSystem } from './ai/prompts.ts'
import { streamVilaoTalk, vilaoTalkConfig } from './ai/vilao-talk.ts'
import { hearSpeech } from './hear-speech.ts'

const active = new Set<number>()
const MAX_AUDIO_BYTES = 10 * 1024 * 1024

export default defineHandler(async (event) => {
  if (event.req.method !== 'POST')
    return new Response('Method not allowed', { status: 405 })
  const form = await event.req.formData()
  const id = Number(form.get('id'))
  if (!Number.isSafeInteger(id) || id <= 0)
    return new Response('Invalid conversation', { status: 400 })
  const convo = db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .get()
  if (!convo || convo.endedAt)
    return new Response('Conversation unavailable', { status: 404 })
  if (active.has(id))
    return new Response('Conversation is already responding', { status: 409 })
  const turns = db
    .select()
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, id))
    .orderBy(asc(conversationTurns.id))
    .all()
  const initial = form.get('initial') === '1'
  if (initial && turns.length !== 0)
    return new Response('Conversation already started', { status: 409 })
  if (!initial && (turns.length === 0 || turns.at(-1)?.role !== 'ai'))
    return new Response('Wait for the previous reply', { status: 409 })
  if (
    !initial &&
    turns.filter((t) => t.role === 'user').length >= MAX_USER_TURNS
  )
    return new Response('Turn limit reached', { status: 409 })
  const audio = form.get('audio')
  if (audio instanceof File && audio.size > MAX_AUDIO_BYTES)
    return new Response('File ghi âm quá lớn (tối đa 10MB)', { status: 413 })
  const typed = String(form.get('text') ?? '')
    .trim()
    .slice(0, 1000)
  if (!initial && !typed && !(audio instanceof File && audio.size))
    return new Response('Hãy nói hoặc nhập câu trả lời', { status: 400 })

  let config: ReturnType<typeof vilaoTalkConfig>
  try {
    config = vilaoTalkConfig()
  } catch (error) {
    return new Response(
      error instanceof Error ? error.message : 'Chưa cấu hình Vilao',
      { status: 400 },
    )
  }
  active.add(id)
  const abort = new AbortController()
  event.req.signal.addEventListener('abort', () => abort.abort(), {
    once: true,
  })
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit = (value: object) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`))
      void (async () => {
        try {
          const said = initial
            ? ''
            : audio instanceof File && audio.size
              ? await hearSpeech(audio)
              : typed
          if (!initial && !said) throw new Error('Không nghe rõ, hãy nói lại')
          if (!initial) emit({ type: 'user', text: said })
          const promptTurns = initial
            ? turns
            : [...turns, { role: 'user', text: said }]
          let reply = ''
          for await (const delta of streamVilaoTalk(
            conversationSystem(convo.topic, convo.level as TalkLevel),
            conversationPrompt(promptTurns),
            config,
            abort.signal,
          )) {
            reply += delta
            emit({ type: 'delta', text: delta })
          }
          reply = reply.trim()
          if (!reply) throw new Error('Vilao trả câu trả lời rỗng')
          if (abort.signal.aborted) throw new Error('Đã huỷ lượt nói')
          db.transaction((tx) => {
            if (!initial)
              tx.insert(conversationTurns)
                .values({ conversationId: id, role: 'user', text: said })
                .run()
            tx.insert(conversationTurns)
              .values({
                conversationId: id,
                role: 'ai',
                text: reply,
                hints: [],
              })
              .run()
          })
          emit({ type: 'done' })
        } catch (error) {
          if (!abort.signal.aborted) {
            try {
              emit({
                type: 'error',
                message:
                  error instanceof Error ? error.message : 'Lỗi hội thoại',
              })
            } catch {
              /* client left */
            }
          }
        } finally {
          active.delete(id)
          try {
            controller.close()
          } catch {
            /* client left */
          }
        }
      })()
    },
    cancel() {
      abort.abort()
      active.delete(id)
    },
  })
  return new Response(body, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    },
  })
})
