import { sqliteTable, integer, text, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

const createdAt = () =>
  integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`)

export const videos = sqliteTable(
  'videos',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    youtubeId: text('youtube_id').notNull(),
    title: text().notNull(),
    channel: text(),
    durationSec: integer('duration_sec'),
    thumbnail: text(),
    /** manual | auto | file (phụ đề người dùng tải lên) | whisper (tự tạo bằng Whisper) */
    captionSource: text('caption_source').notNull(),
    /** file local: tên file trong DATA_DIR/media, null với YouTube/Vimeo */
    mediaPath: text('media_path'),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('videos_youtube_id_idx').on(t.youtubeId)],
)

export const segments = sqliteTable(
  'segments',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    videoId: integer('video_id')
      .notNull()
      .references(() => videos.id, { onDelete: 'cascade' }),
    idx: integer().notNull(),
    startMs: integer('start_ms').notNull(),
    endMs: integer('end_ms').notNull(),
    text: text().notNull(),
    /** JSON: Array<{ w: string; s: number; e: number }> (ms), có thể rỗng */
    wordsJson: text('words_json').notNull().default('[]'),
  },
  (t) => [index('segments_video_idx').on(t.videoId, t.idx)],
)

export const dictationAttempts = sqliteTable(
  'dictation_attempts',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    segmentId: integer('segment_id')
      .notNull()
      .references(() => segments.id, { onDelete: 'cascade' }),
    input: text().notNull(),
    score: real().notNull(),
    diffJson: text('diff_json').notNull(),
    aiJson: text('ai_json'),
    createdAt: createdAt(),
  },
  (t) => [index('dictation_segment_idx').on(t.segmentId)],
)

export const pronunciationAttempts = sqliteTable(
  'pronunciation_attempts',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    segmentId: integer('segment_id')
      .notNull()
      .references(() => segments.id, { onDelete: 'cascade' }),
    /** shadow | repeat */
    mode: text().notNull(),
    transcript: text().notNull(),
    accuracy: real().notNull(),
    completeness: real().notNull(),
    wpm: real(),
    refWpm: real('ref_wpm'),
    wordsJson: text('words_json').notNull(),
    aiJson: text('ai_json'),
    audioPath: text('audio_path'),
    createdAt: createdAt(),
  },
  (t) => [index('pron_segment_idx').on(t.segmentId)],
)

export const mistakes = sqliteTable(
  'mistakes',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    word: text().notNull(),
    heard: text(),
    type: text().notNull(),
    /** dictation | pronunciation | grammar */
    source: text().notNull(),
    segmentId: integer('segment_id').references(() => segments.id, {
      onDelete: 'set null',
    }),
    explanation: text(),
    tip: text(),
    ipa: text(),
    /** lỗi bài tập ngữ pháp: "<unit>#<exercise>#<câu>", vd. "12#12.2#3" */
    grammarRef: text('grammar_ref'),
    count: integer().notNull().default(1),
    lastSeenAt: integer('last_seen_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex('mistakes_word_type_source_idx').on(t.word, t.type, t.source)],
)

export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
})

export type Video = typeof videos.$inferSelect
export type Segment = typeof segments.$inferSelect
export type DictationAttempt = typeof dictationAttempts.$inferSelect
export type PronunciationAttempt = typeof pronunciationAttempts.$inferSelect
export type Mistake = typeof mistakes.$inferSelect

/** Cache tra từ điển bằng AI: key = từ/cụm từ (lowercase) + câu ngữ cảnh */
export const lookups = sqliteTable('lookups', {
  key: text().primaryKey(),
  json: text().notNull(),
  createdAt: createdAt(),
})

/**
 * Bộ thẻ từ vựng: transcript (lưu từ khi tra trong video) | anki (import từ .apkg) | custom
 * | essential (sách từ vựng essentialenglish.review)
 */
export const decks = sqliteTable(
  'decks',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    source: text().notNull(),
    /** tên sách khi bộ là một unit của sách (essential): danh sách bộ thẻ gộp các unit theo sách */
    book: text(),
    /** id ổn định của unit, vd. ee:<slug>:<unit index>; null = bộ thường */
    ref: text(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('decks_ref_idx').on(t.ref)],
)

/** thông tin tra thêm cho thẻ (từ điển dunno.ai / AI), lưu JSON trong cards.info */
export interface CardInfo {
  /** từ loại bằng tiếng Việt, vd. "danh từ" */
  pos: string | null
  /** src: link câu gốc khi lấy từ Tatoeba (CC BY, phải ghi nguồn) */
  examples: Array<{ en: string; vi: string; src?: string }>
  /** cụm từ hay đi kèm, vd. type "verb + decision": "make, reach, take" */
  collocations: Array<{ type: string; words: string; example: string }>
  /** thành ngữ / cụm cố định chứa từ, kèm nghĩa tiếng Việt */
  idioms: Array<{ en: string; vi: string }>
  family: Array<{ kind: string; words: string[] }>
  synonyms: string[]
}

/** Thẻ học kiểu Anki, lịch ôn tính bằng FSRS (src/server/srs.ts) */
export const cards = sqliteTable(
  'cards',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    deckId: integer('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    front: text().notNull(),
    back: text().notNull(),
    ipa: text(),
    example: text(),
    extra: text(),
    /** tên file trong DATA_DIR/card-media (audio import từ Anki) */
    audioFile: text('audio_file'),
    /** URL ảnh/audio trong app, vd. /api/essential-media/… (sách từ vựng essentialenglish.review) */
    imageUrl: text('image_url'),
    audioUrl: text('audio_url'),
    /** nghĩa tiếng Việt tra bổ sung khi học (sách essentialenglish.review chỉ có định nghĩa tiếng Anh); null = chưa tra */
    meaningVi: text('meaning_vi'),
    /** từ loại, ví dụ, cụm từ, họ từ… tra bổ sung cùng lúc với meaningVi; null = chưa tra */
    info: text({ mode: 'json' }).$type<CardInfo>(),
    // ngữ cảnh khi lưu từ transcript
    segmentId: integer('segment_id').references(() => segments.id, { onDelete: 'set null' }),
    sentence: text(),
    clipStartMs: integer('clip_start_ms'),
    clipEndMs: integer('clip_end_ms'),
    ankiGuid: text('anki_guid'),
    // trạng thái FSRS
    due: integer({ mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
    stability: real().notNull().default(0),
    difficulty: real().notNull().default(0),
    elapsedDays: integer('elapsed_days').notNull().default(0),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    learningSteps: integer('learning_steps').notNull().default(0),
    reps: integer().notNull().default(0),
    lapses: integer().notNull().default(0),
    /** 0 New | 1 Learning | 2 Review | 3 Relearning */
    state: integer().notNull().default(0),
    lastReview: integer('last_review', { mode: 'timestamp' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('cards_deck_due_idx').on(t.deckId, t.due),
    uniqueIndex('cards_deck_guid_idx').on(t.deckId, t.ankiGuid),
    index('cards_front_idx').on(t.front),
  ],
)

export const reviewLogs = sqliteTable(
  'review_logs',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    cardId: integer('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    rating: integer().notNull(),
    state: integer().notNull(),
    due: integer({ mode: 'timestamp' }).notNull(),
    stability: real().notNull(),
    difficulty: real().notNull(),
    elapsedDays: integer('elapsed_days').notNull(),
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [index('review_logs_card_idx').on(t.cardId)],
)

export type Deck = typeof decks.$inferSelect
export type Card = typeof cards.$inferSelect

/** Câu trả lời bài tập ngữ pháp (English Grammar in Use): giữ lần làm gần nhất của mỗi câu */
export const grammarAnswers = sqliteTable(
  'grammar_answers',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    /** id unit trong sách: "12" | "appendix-3" */
    unitId: text('unit_id').notNull(),
    /** "<exercise>#<câu>", vd. "12.2#3" */
    itemKey: text('item_key').notNull(),
    answer: text().notNull(),
    correct: integer({ mode: 'boolean' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex('grammar_answers_unit_item_idx').on(t.unitId, t.itemKey)],
)
