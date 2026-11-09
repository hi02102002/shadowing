import { createServerFn } from '@tanstack/react-start'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { db } from '#/db/index.ts'
import { conversations, conversationTurns } from '#/db/schema.ts'
import type { ConversationFeedback } from '#/db/schema.ts'
import {
  CUSTOM_SCENARIO,
  IELTS_PART3,
  SCENARIOS,
  TALK_LEVELS,
  isIeltsScenario,
  part3Setup,
} from '#/lib/conversation.ts'
import type { TalkLevel } from '#/lib/conversation.ts'
import {
  CONVERSATION_FEEDBACK_SYSTEM,
  ConversationFeedbackSchema,
  IeltsConversationFeedbackSchema,
  conversationFeedbackPrompt,
} from '../ai/prompts.ts'
import { structured } from '../ai/provider.ts'
import { vilaoTalkConfig } from '../ai/vilao-talk.ts'
import { getConfig } from '../config.ts'
import { recordSpeechMistakes } from '../mistakes.ts'

function requireConversation(id: number) {
  const convo = db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .get()
  if (!convo) throw new Error('Không tìm thấy buổi hội thoại')
  return convo
}

const turnsOf = (id: number) =>
  db
    .select()
    .from(conversationTurns)
    .where(eq(conversationTurns.conversationId, id))
    .orderBy(asc(conversationTurns.id))
    .all()

export const listConversations = createServerFn({ method: 'GET' }).handler(
  async () =>
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
  .handler(async ({ data }) => ({
    ...requireConversation(data.id),
    turns: turnsOf(data.id),
  }))

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
    vilaoTalkConfig()
    let topic: string
    if (data.scenario === CUSTOM_SCENARIO) {
      if (!data.custom) throw new Error('Hãy nhập chủ đề muốn nói')
      topic = data.custom
    } else if (data.scenario === IELTS_PART3) {
      if (!data.custom) throw new Error('Thiếu đề Part 2')
      topic = part3Setup(data.custom)
    } else {
      const preset = SCENARIOS.find((s) => s.id === data.scenario)
      if (!preset) throw new Error('Không có tình huống này')
      topic = preset.setup
    }
    const convo = db
      .insert(conversations)
      .values({ scenario: data.scenario, topic, level: data.level })
      .returning()
      .get()
    return { id: convo.id }
  })

export const finishConversation = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }): Promise<ConversationFeedback> => {
    const convo = requireConversation(data.id)
    if (convo.feedback) return convo.feedback
    const turns = turnsOf(convo.id)
    if (!turns.some((t) => t.role === 'user'))
      throw new Error('Bạn chưa nói câu nào trong buổi này')
    const vilao = vilaoTalkConfig()
    const feedback = await structured({
      feature: 'conversation',
      cfg: {
        ...getConfig(),
        llmProvider: 'openai-compatible',
        llmApiKey: vilao.talkVilaoApiKey,
        llmBaseUrl: vilao.talkVilaoBaseUrl,
        llmModel: vilao.talkVilaoModel,
      },
      system: CONVERSATION_FEEDBACK_SYSTEM,
      prompt: conversationFeedbackPrompt({
        topic: convo.topic,
        level: convo.level as TalkLevel,
        turns,
      }),
      schema: isIeltsScenario(convo.scenario)
        ? IeltsConversationFeedbackSchema
        : ConversationFeedbackSchema,
    })
    db.update(conversations)
      .set({ feedback, endedAt: new Date() })
      .where(eq(conversations.id, convo.id))
      .run()
    recordSpeechMistakes('conversation', feedback.corrections)
    return feedback
  })

export const deleteConversation = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    db.delete(conversations).where(eq(conversations.id, data.id)).run()
    return { ok: true }
  })
