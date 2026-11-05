/** AI sinh thẻ cho trình tạo thẻ Anki: từ vựng (kèm chunks), ghi chú ngôn ngữ, chunks theo bài học. Dùng cấu hình LLM của app. */
import { z } from 'zod'

import {
  normalizePartOfSpeech,
  phraseContainsWord,
} from '#/lib/anki-builder.ts'
import type { GeneratedNote, GeneratedVocabulary } from '#/lib/anki-builder.ts'
import { getConfig, hasLlm } from './config.ts'
import { structured } from './ai/provider.ts'
import { phraseToIpa } from './ipa.ts'

const LexicalChunkSchema = z.object({
  text: z
    .string()
    .describe(
      'Natural high-frequency English lexical chunk or collocation related to the lesson context, e.g. "shake hands"',
    ),
  ipa: z
    .string()
    .describe('British English (RP) IPA in slashes, e.g. /ˈʃeɪk hændz/'),
  meaningVi: z
    .string()
    .describe('Concise, natural Vietnamese meaning in the lesson context'),
  englishDefinition: z
    .string()
    .describe('Simple English definition explaining how the chunk is used'),
  example: z
    .string()
    .describe(
      'A simple, short example sentence (8-16 words) in British English, in the lesson theme',
    ),
  imageQuery: z
    .string()
    .describe('Safe, concrete visual search query without quotes'),
  partOfSpeech: z.string().describe('phrase, phrasal verb, or idiom'),
})

const FlashcardSchema = z.object({
  word: z.string().describe('The English vocabulary word or phrase'),
  ipa: z
    .string()
    .describe('British English (RP) IPA enclosed in slashes, e.g. /ˈvaʊ.tʃər/'),
  vietnamese: z
    .string()
    .describe('Vietnamese translation or concise meaning for learners'),
  englishDefinition: z
    .string()
    .describe(
      'Clear, simple, learner-friendly English definition in this lesson theme',
    ),
  example: z
    .string()
    .describe(
      'A simple example sentence (8-16 words) in British English, in the lesson theme',
    ),
  imageQuery: z
    .string()
    .describe('Safe, concrete visual search query without quotes'),
  partOfSpeech: z
    .string()
    .describe(
      'noun, verb, adjective, adverb, phrase, phrasal verb, idiom, preposition, or conjunction',
    ),
  chunks: z
    .array(LexicalChunkSchema)
    .describe('1 to 2 lexical chunks using this word in the lesson context'),
})
const FlashcardsSchema = z.object({ cards: z.array(FlashcardSchema) })

const NoteSchema = z.object({
  title: z.string(),
  content: z.array(z.string()),
  vietnameseExplanation: z.string(),
  example: z.string(),
})
const NotesSchema = z.object({ notes: z.array(NoteSchema) })

const StandaloneChunkSchema = z.object({
  word: z
    .string()
    .describe('The lexical chunk or expression, e.g. "take advantage of"'),
  ipa: z.string(),
  vietnamese: z.string(),
  englishDefinition: z.string(),
  example: z.string(),
  imageQuery: z.string(),
  partOfSpeech: z.string().describe('phrase, phrasal verb, or idiom'),
})
const StandaloneChunksSchema = z.object({
  cards: z.array(StandaloneChunkSchema),
})

function requireLlm() {
  if (!hasLlm(getConfig()))
    throw new Error(
      'Chưa cấu hình AI. Vào Cài đặt để chọn nhà cung cấp và nhập API key.',
    )
}

/** lỗi tạm thời (quá tải, timeout, model trả JSON hỏng) → thử lại */
async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (
        attempt >= tries ||
        !/50[234]|429|time(d )?out|JSON|cấu trúc/i.test(msg)
      )
        throw err
      await new Promise((r) => setTimeout(r, 1500 * attempt))
    }
  }
}

const VOCAB_SYSTEM = `You are an expert bilingual English lexicographer and pedagogue creating clean, memorable English vocabulary flashcards with British English (UK) pronunciation and authentic usage for Vietnamese learners.

CORE PRINCIPLES & GUIDELINES:
1. SIMPLE, EASY-TO-UNDERSTAND & CONTEXTUAL EXAMPLES (CRITICAL):
   - Every example sentence MUST be SIMPLE, CLEAR, and DIRECTLY ROOTED in the specific lesson theme/topic (e.g. if the lesson is "The body and movement", illustrate body movements, gestures, postures, or physical sensations like nodding, bending down, aching back, touching toes).
   - Keep sentences concise, natural, and punchy (ideally 8 to 16 words).
   - Use straightforward everyday vocabulary (A2–B1 CEFR level) so the learner focuses effortlessly on the target word without stumbling over other words.
   - The example sentence must make the meaning of the target word/chunk immediately obvious from context.
   - Avoid long, convoluted, compound-complex sentences or literary jargon.
2. LESSON-RELEVANT LEXICAL CHUNKS:
   - For each word/phrase, provide 1 to 2 high-frequency, authentic lexical chunks showing how native British speakers naturally use this word in the lesson's context.
   - NO REDUNDANCY: Never supply two nearly identical chunks (e.g. NEVER give both "take a bath" and "have a bath").
   - Each chunk MUST have its own accurate UK IPA (/.../), natural Vietnamese translation, concise English usage explanation, and a short, simple example sentence (8-16 words) in the lesson context.
3. LEARNER-FRIENDLY ENGLISH DEFINITIONS:
   - Write in the style of Oxford Advanced Learner's Dictionary / Cambridge Dictionary: clear, conversational, explaining how and when the word is used in this topic.
   - Avoid dry, circular robotic boilerplate like "the act of...", "a device used for...".
4. IDIOMATIC VIETNAMESE (TỰ NHIÊN, CHUẨN XÁC):
   - Translate into natural, idiomatic Vietnamese that reflects actual everyday speech and modern usage.
   - Include common collocations or usage notes in parentheses where helpful (e.g. "bồn tắm; việc tắm bồn / ngâm mình").
5. BRITISH ENGLISH (UK) IPA & SPELLING:
   - Use standard British English (Received Pronunciation - RP) IPA transcription enclosed in slashes (e.g. /ˈwɔː.tər/, /ˈʃed.juːl/, /ˈvaʊ.tʃər/).
   - Prefer British English spelling and natural UK phrasing where applicable.
6. PHOTOGRAPHY IMAGE QUERIES:
   - Write concrete visual descriptions with atmospheric photography keywords suitable for search engines. No quotation marks.`

const NOTES_SYSTEM = `You create high-yield, practical language and grammar study notes from English textbook sections for Vietnamese learners with British English usage.

GUIDELINES:
- Distill key grammatical formulas/forms (e.g. S + am/is/are + V-ing), collocations, structural patterns, and usage rules into crisp, memorable bullet points.
- For grammar rules or contrastive notes (e.g. "not ..."): clearly highlight the exact formula (Form), when to use vs. when NOT to use, and common learner pitfalls.
- For practice exercises, preserve key example problems with bracketed answers [answer].
- vietnameseExplanation: Clear, engaging explanation in natural Vietnamese explaining WHEN, WHY, and HOW native speakers use these structures/patterns in real life.
- example: A SIMPLE, CLEAR, and practical example sentence in British English (8-16 words) directly illustrating the rule or pattern in an everyday, relatable context. Keep the vocabulary accessible (A2-B1 level) so learners can immediately grasp how the rule works.`

const CHUNKS_SYSTEM = `You are an expert English teacher specialized in Lexical Chunking methodology. From the provided vocabulary list, lesson theme, and context, generate 6 to 12 high-yield, authentic Lexical Chunks with British English (UK) usage and pronunciation.

CRITICAL RULES FOR CHUNKS & EXAMPLES:
1. STRICT LESSON THEME RELEVANCE (QUAN TRỌNG):
   - Every chunk and its example sentence MUST be tightly focused on the Lesson Theme / Topic.
   - If the lesson is about the body, use actions, expressions, gestures, and sensations directly related to the body.
2. SIMPLE, CLEAR & EASY TO UNDERSTAND EXAMPLES (DỄ HIỂU & NGẮN GỌN):
   - Each example sentence MUST be simple, short (8 to 16 words), and easy to understand for everyday learners (A2-B1 level).
   - Use straightforward vocabulary so learners immediately grasp how native speakers use this chunk in context.
   - Avoid long, convoluted, or abstract sentence structures.
3. CATEGORY DIVERSITY:
   - Strong Collocations: Verb + Noun ("nod one's head", "blow one's nose", "take a deep breath"), Adj + Noun ("sore throat", "sharp pain")
   - Phrasal Verbs & Verb Phrases ("bend down", "stand up", "lie down")
   - Conversational & Prepositional Phrases ("on one's feet", "from head to toe")
4. IDIOMATIC VIETNAMESE:
   - Provide natural, fluent Vietnamese meanings that capture the real pragmatic nuance.
5. BRITISH ENGLISH (UK) IPA:
   - Standard British English (UK / Received Pronunciation) IPA transcription enclosed in slashes.`

/** IPA Anh-Anh từ từ điển CMU; chỉ khi không có mới giữ IPA do AI viết */
const localIpa = async (text: string, fallback: string) =>
  (await phraseToIpa(text, 'uk')) ?? fallback

export async function enrichVocabulary(
  words: string[],
  topic?: string,
  phrases?: string[],
): Promise<GeneratedVocabulary[]> {
  if (!words.length) return []
  requireLlm()
  const topicContext = topic?.trim()
    ? `\nLesson Theme / Context: "${topic.trim()}"\n`
    : ''
  const relevant = (phrases ?? []).filter((p) =>
    words.some((w) => phraseContainsWord(p, w)),
  )
  const include = relevant.length ? relevant : (phrases ?? []).slice(0, 8)
  const phrasesContext = include.length
    ? `\nKey Lesson Collocations & Phrases to integrate:\n${include.join(', ')}\n`
    : ''
  const prompt = `Create clear, natural, and memorable flashcards for the following items preserving exact item order.${topicContext}${phrasesContext}
Rules: every example sentence must directly reflect the lesson theme "${topic || 'English in Use'}", be simple and short (8-16 words, CEFR A2-B1), in British English; chunks must be natural, non-redundant, each with its own UK IPA, Vietnamese meaning and a short example; image queries are concrete photographic scenes without quotes.

Items to process:
${words.map((w, i) => `${i + 1}. ${w}`).join('\n')}`

  const out = await withRetry(() =>
    structured({ system: VOCAB_SYSTEM, prompt, schema: FlashcardsSchema }),
  )
  const cards = out.cards.map((item, i) => ({
    word: item.word.trim() || words[i] || '',
    ipa: item.ipa.trim(),
    vietnamese: item.vietnamese.trim(),
    englishDefinition: item.englishDefinition.trim(),
    example: item.example.trim(),
    imageQuery: item.imageQuery.trim() || item.word,
    partOfSpeech: normalizePartOfSpeech(item.partOfSpeech) || 'noun',
    chunks: item.chunks
      .filter((c) => c.text.trim())
      .map((c) => ({
        text: c.text.trim(),
        ipa: c.ipa.trim(),
        meaningVi: c.meaningVi.trim(),
        englishDefinition: c.englishDefinition.trim(),
        example: c.example.trim(),
        imageQuery: c.imageQuery.trim() || c.text.trim(),
        partOfSpeech: normalizePartOfSpeech(c.partOfSpeech) || 'phrase',
      })),
  }))
  await Promise.all(
    cards.map(async (card) => {
      card.ipa = await localIpa(card.word, card.ipa)
      for (const c of card.chunks) c.ipa = await localIpa(c.text, c.ipa)
    }),
  )
  return cards
}

export async function enrichNotes(
  raw: Array<{ title: string; content: string[] }>,
): Promise<GeneratedNote[]> {
  if (!raw.length) return []
  requireLlm()
  const prompt = `Enrich the following ${raw.length} language notes for Vietnamese learners, keeping the same order:\n${raw
    .map(
      (n, i) =>
        `### Note ${i + 1}: ${n.title}\nRaw content:\n${n.content.map((c) => `- ${c}`).join('\n')}`,
    )
    .join('\n\n')}`
  const out = await withRetry(() =>
    structured({ system: NOTES_SYSTEM, prompt, schema: NotesSchema }),
  )
  return raw.map((orig, i) => {
    const g = out.notes.at(i)
    return {
      title: g?.title.trim() || orig.title,
      content: g?.content.length
        ? g.content.map((c) => c.trim())
        : orig.content,
      vietnameseExplanation: g?.vietnameseExplanation.trim() ?? '',
      example: g?.example.trim() || orig.content[0] || '',
    }
  })
}

export async function generateLessonChunks(
  words: string[],
  storyText?: string,
  topic?: string,
): Promise<GeneratedVocabulary[]> {
  requireLlm()
  const prompt = `Generate 6 to 12 diverse, authentic lexical chunks based on this lesson:
${topic?.trim() ? `Lesson Theme / Topic: "${topic.trim()}"\n` : ''}
Vocabulary words:
${words.slice(0, 40).join(', ')}

${storyText ? `Context / Reading text from lesson:\n${storyText.slice(0, 1500)}` : ''}`
  const out = await withRetry(() =>
    structured({
      system: CHUNKS_SYSTEM,
      prompt,
      schema: StandaloneChunksSchema,
    }),
  )
  const cards = out.cards
    .filter((c) => c.word.trim())
    .map((c) => ({
      word: c.word.trim(),
      ipa: c.ipa.trim(),
      vietnamese: c.vietnamese.trim(),
      englishDefinition: c.englishDefinition.trim(),
      example: c.example.trim(),
      imageQuery: c.imageQuery.trim() || c.word.trim(),
      partOfSpeech: normalizePartOfSpeech(c.partOfSpeech) || 'phrase',
    }))
  await Promise.all(
    cards.map(async (c) => (c.ipa = await localIpa(c.word, c.ipa))),
  )
  return cards
}
