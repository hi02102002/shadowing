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
    /** dictation | pronunciation */
    source: text().notNull(),
    segmentId: integer('segment_id').references(() => segments.id, {
      onDelete: 'set null',
    }),
    explanation: text(),
    tip: text(),
    ipa: text(),
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
