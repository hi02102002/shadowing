import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { conversations, conversationTurns } from '#/db/schema.ts'
import type { ConversationFeedback } from '#/db/schema.ts'
import { CUSTOM_SCENARIO, MAX_USER_TURNS, SCENARIOS, TALK_LEVELS } from '#/lib/conversation.ts'
import type { TalkLevel } from '#/lib/conversation.ts'
import {
  CONVERSATION_FEEDBACK_SYSTEM,
  ConversationFeedbackSchema,
  ConversationReplySchema,
  conversationFeedbackPrompt,
  conversationPrompt,
  conversationSystem,
} from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { hearSpeech } from '../hear-speech.ts'
import { recordSpeechMistakes } from '../mistakes.ts'

const MAX_AUDIO_BYTES = 10 * 1024 * 1024

function requireConversation(id: number) {
  const convo = db.select().from(conversations).where(eq(conversations.id, id)).get()
  if (!convo) throw new Error('Không tìm thấy buổi hội thoại')
  return convo
}

const turnsOf = (id: number) =>
  db.select().from(conversationTurns).where(eq(conversationTurns.conversationId, id)).orderBy(asc(conversationTurns.id)).all()

/** AI nói lượt tiếp theo (hoặc câu mở đầu) và lưu lại */
async function aiTurn(convo: { id: number; topic: string; level: string }) {
  const turns = turnsOf(convo.id)
  const { reply, hints } = await structured({
    system: conversationSystem(convo.topic, convo.level as TalkLevel),
    prompt: conversationPrompt(turns),
    schema: ConversationReplySchema,
  })
  return db
    .insert(conversationTurns)
    .values({ conversationId: convo.id, role: 'ai', text: reply.trim(), hints: hints.slice(0, 3) })
    .returning()
    .get()
}

export const listConversations = createServerFn({ method: 'GET' }).handler(async () =>
  db
    .select({
      id: conversations.id,
      scenario: conversations.scenario,
      topic: conversations.topic,
      level: conversations.level,
      createdAt: conversations.createdAt,
      endedAt: conversations.endedAt,
      turns: sql<number>`(select count(*) from ${conversationTurns} where ${conversationTurns.conversationId} = ${conversations.id} and ${conversationTurns.role} = 'user')`,
    })
    .from(conversations)
    .orderBy(desc(conversations.id))
    .limit(20)
    .all(),
)

export const getConversation = createServerFn({ method: 'GET' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => ({ ...requireConversation(data.id), turns: turnsOf(data.id) }))

export type ConversationDetail = Awaited<ReturnType<typeof getConversation>>

export const startConversation = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      scenario: z.string(),
      /** chủ đề tự nhập khi scenario = custom */
      custom: z.string().trim().max(300).optional(),
      level: z.enum(TALK_LEVELS),
    }),
  )
  .handler(async ({ data }) => {
    let topic: string
    if (data.scenario === CUSTOM_SCENARIO) {
      if (!data.custom) throw new Error('Hãy nhập chủ đề muốn nói')
      topic = data.custom
    } else {
      const preset = SCENARIOS.find((s) => s.id === data.scenario)
      if (!preset) throw new Error('Không có tình huống này')
      topic = preset.setup
    }
    const convo = db.insert(conversations).values({ scenario: data.scenario, topic, level: data.level }).returning().get()
    try {
      await aiTurn(convo)
    } catch (err) {
      // AI lỗi (chưa cấu hình, hết quota…) thì không để lại buổi trống
      db.delete(conversations).where(eq(conversations.id, convo.id)).run()
      throw err
    }
    return { id: convo.id }
  })

export const sendTurn = createServerFn({ method: 'POST' })
  .validator((form: FormData) => {
    if (!(form instanceof FormData)) throw new Error('Dữ liệu không hợp lệ')
    const audio = form.get('audio')
    const text = form.get('text')
    if (audio instanceof File && audio.size > MAX_AUDIO_BYTES) throw new Error('File ghi âm quá lớn (tối đa 10MB)')
    return {
      id: z.coerce.number().int().parse(form.get('id')),
      audio: audio instanceof File && audio.size > 0 ? audio : null,
      text: typeof text === 'string' ? text.trim().slice(0, 1000) : '',
    }
  })
  .handler(async ({ data }) => {
    const convo = requireConversation(data.id)
    if (convo.endedAt) throw new Error('Buổi hội thoại đã kết thúc')
    const said = data.audio ? await hearSpeech(data.audio) : data.text
    if (!said) throw new Error(data.audio ? 'Không nghe rõ, hãy nói lại' : 'Hãy nhập câu trả lời')
    const userTurns = turnsOf(convo.id).filter((t) => t.role === 'user').length
    if (userTurns >= MAX_USER_TURNS) throw new Error(`Mỗi buổi tối đa ${MAX_USER_TURNS} lượt. Hãy kết thúc để xem nhận xét.`)

    const user = db.insert(conversationTurns).values({ conversationId: convo.id, role: 'user', text: said }).returning().get()
    try {
      return { user, ai: await aiTurn(convo) }
    } catch (err) {
      // AI không trả lời được thì bỏ lượt vừa nói để người học nói lại
      db.delete(conversationTurns).where(eq(conversationTurns.id, user.id)).run()
      throw err
    }
  })

export const finishConversation = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }): Promise<ConversationFeedback> => {
    const convo = requireConversation(data.id)
    if (convo.feedback) return convo.feedback
    const turns = turnsOf(convo.id)
    if (!turns.some((t) => t.role === 'user')) throw new Error('Bạn chưa nói câu nào trong buổi này')
    const feedback = await structured({
      system: CONVERSATION_FEEDBACK_SYSTEM,
      prompt: conversationFeedbackPrompt({ topic: convo.topic, level: convo.level as TalkLevel, turns }),
      schema: ConversationFeedbackSchema,
    })
    db.update(conversations).set({ feedback, endedAt: new Date() }).where(eq(conversations.id, convo.id)).run()
    recordSpeechMistakes('conversation', feedback.corrections)
    return feedback
  })

export const deleteConversation = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    db.delete(conversations).where(eq(conversations.id, data.id)).run()
    return { ok: true }
  })
