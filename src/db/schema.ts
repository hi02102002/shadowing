import {
  sqliteTable,
  integer,
  text,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import type { ListeningSection } from '#/lib/listening'

const createdAt = () =>
  integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)

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
    /** dictation | pronunciation | grammar | conversation | speaking | reading | listening | reflex */
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
  (t) => [
    uniqueIndex('mistakes_word_type_source_idx').on(t.word, t.type, t.source),
  ],
)

export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text().notNull(),
})

/** Buổi hội thoại nhập vai với AI (trang /talk) */
export const conversations = sqliteTable('conversations', {
  id: integer().primaryKey({ autoIncrement: true }),
  /** id tình huống có sẵn (src/lib/conversation.ts) hoặc "custom" */
  scenario: text().notNull(),
  /** mô tả tình huống đưa cho AI; với "custom" là chủ đề người học tự nhập */
  topic: text().notNull(),
  /** A2 | B1 | B2 */
  level: text().notNull(),
  /** nhận xét cuối buổi (ConversationFeedback), null = chưa kết thúc */
  feedback: text({ mode: 'json' }).$type<ConversationFeedback>(),
  createdAt: createdAt(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
})

export const conversationTurns = sqliteTable(
  'conversation_turns',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    conversationId: integer('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    /** user | ai */
    role: text().notNull(),
    text: text().notNull(),
    /** lượt AI: vài câu người học có thể đáp lại */
    hints: text({ mode: 'json' }).$type<string[]>(),
    createdAt: createdAt(),
  },
  (t) => [index('conversation_turns_conv_idx').on(t.conversationId)],
)

/** nhận xét cuối buổi hội thoại, cùng cấu trúc với ConversationFeedbackSchema (src/server/ai/prompts.ts) */
export interface ConversationFeedback {
  summary: string
  corrections: Array<{
    said: string
    better: string
    type: string
    explanation: string
  }>
  phrases: Array<{ en: string; vi: string }>
  /** band ước lượng, chỉ có ở buổi luyện IELTS Speaking Part 1 / Part 3 */
  band?: number | null
}

/** Bài nói theo đề kiểu IELTS Speaking Part 2 (trang /speaking) */
export const speakingAttempts = sqliteTable('speaking_attempts', {
  id: integer().primaryKey({ autoIncrement: true }),
  /** id đề có sẵn (src/lib/speaking-topics.ts) hoặc "custom" khi người học dán đề */
  topicId: text('topic_id').notNull(),
  title: text().notNull(),
  bullets: text({ mode: 'json' }).notNull().$type<string[]>(),
  /** band mục tiêu: 5 | 6 | 7 (SPEAKING_TARGETS), quyết định độ khó bài mẫu và từ vựng gợi ý */
  target: text().notNull().default('6'),
  transcript: text().notNull(),
  durationSec: integer('duration_sec').notNull(),
  /** file ghi âm trong DATA_DIR/recordings, nghe lại qua /api/speaking-audio/:id */
  audioPath: text('audio_path'),
  /** nhận xét và band ước lượng (SpeakingFeedback), null = chưa chấm xong */
  feedback: text({ mode: 'json' }).$type<SpeakingFeedback>(),
  createdAt: createdAt(),
})

/** cùng cấu trúc với SpeakingFeedbackSchema (src/server/ai/prompts.ts) */
export interface SpeakingFeedback {
  overall: number
  criteria: Array<{ name: string; band: number; comment: string }>
  covered: Array<{ point: string; done: boolean }>
  summary: string
  corrections: Array<{
    said: string
    better: string
    type: string
    explanation: string
  }>
  vocabulary: Array<{ en: string; vi: string }>
  sample: string
  /** chỉ có khi chấm bằng model nghe được audio */
  pronunciation?: {
    band: number
    comment: string
    mistakes: Array<{
      word: string
      heard: string
      type: string
      ipa: string
      explanation: string
      tip: string
    }>
  }
}

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
    segmentId: integer('segment_id').references(() => segments.id, {
      onDelete: 'set null',
    }),
    sentence: text(),
    clipStartMs: integer('clip_start_ms'),
    clipEndMs: integer('clip_end_ms'),
    ankiGuid: text('anki_guid'),
    // trạng thái FSRS
    due: integer({ mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
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
    reviewedAt: integer('reviewed_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
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
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [uniqueIndex('grammar_answers_unit_item_idx').on(t.unitId, t.itemKey)],
)

/** Bài đọc hiểu (trang /reading): AI viết theo chủ đề và trình độ, hoặc lấy từ nguồn bài đọc chia cấp độ */
export const readingPassages = sqliteTable('reading_passages', {
  id: integer().primaryKey({ autoIncrement: true }),
  /** ai | british-council | breaking-news | onestop | linguapress (READING_SOURCES) */
  source: text().notNull().default('ai'),
  /** trang gốc của bài lấy từ nguồn ngoài, null với bài AI viết */
  sourceUrl: text('source_url'),
  /** chủ đề người học chọn hoặc tự nhập */
  topic: text().notNull(),
  /** A2 | B1 | B2 | C1 (READING_LEVELS) */
  level: text().notNull(),
  /** dạng đề của bộ câu hỏi: standard | ielts | toeic (READING_FORMATS) */
  format: text().notNull().default('standard'),
  title: text().notNull(),
  /** các đoạn văn */
  paragraphs: text({ mode: 'json' }).notNull().$type<string[]>(),
  /** từ khó trong bài kèm nghĩa tiếng Việt */
  glossary: text({ mode: 'json' })
    .notNull()
    .$type<Array<{ en: string; vi: string }>>(),
  questions: text({ mode: 'json' }).notNull().$type<ReadingQuestion[]>(),
  /** câu trả lời lần nộp gần nhất, theo thứ tự câu hỏi; null = chưa nộp */
  answers: text({ mode: 'json' }).$type<string[]>(),
  /** số câu đúng lần nộp gần nhất */
  score: integer(),
  /** chỗ người học bôi màu trong bài (ReadingHighlight), giữ qua các lần làm */
  highlights: text({ mode: 'json' })
    .notNull()
    .default([])
    .$type<ReadingHighlight[]>(),
  answeredAt: integer('answered_at', { mode: 'timestamp' }),
  createdAt: createdAt(),
})

/** Bài luyện nghe: nội dung được chia theo section, câu trả lời lưu phẳng theo thứ tự toàn bài. */
export const listeningPassages = sqliteTable('listening_passages', {
  id: integer().primaryKey({ autoIncrement: true }),
  source: text().notNull(),
  sourceUrl: text('source_url').notNull(),
  title: text().notNull(),
  level: text().notNull(),
  topic: text().notNull(),
  /** standard | ielts */
  format: text().notNull().default('standard'),
  sections: text({ mode: 'json' }).notNull().$type<ListeningSection[]>(),
  answers: text({ mode: 'json' }).$type<string[]>(),
  score: integer(),
  answeredAt: integer('answered_at', { mode: 'timestamp' }),
  createdAt: createdAt(),
})

/** đoạn bôi màu: vị trí ký tự [start, end) trong đoạn văn thứ p */
export interface ReadingHighlight {
  p: number
  start: number
  end: number
  /** cùng danh sách với HIGHLIGHT_COLORS (src/lib/highlights.ts) */
  color: 'yellow' | 'green' | 'pink' | 'blue'
}

/** cùng cấu trúc với câu hỏi trong ReadingPassageSchema (src/server/ai/prompts.ts) sau khi lọc */
export interface ReadingQuestion {
  /** choice | tfng | ynng | heading | gap | short | multi (READING_QUESTION_TYPES) */
  type: string
  prompt: string
  options: string[]
  answers: string[]
  /** câu trích nguyên văn trong bài làm căn cứ cho đáp án */
  evidence: string
  explanation: string
  /** hướng dẫn chung của nhóm câu trong đề gốc (vd. "Which paragraph contains…"), các câu liền nhau cùng hướng dẫn là một nhóm */
  instruction?: string
}

/** Buổi luyện phản xạ nói (trang /reflex) */
export const reflexSessions = sqliteTable('reflex_sessions', {
  id: integer().primaryKey({ autoIncrement: true }),
  /** translate | qa | situation | pattern (src/lib/reflex.ts) */
  mode: text().notNull(),
  /** bank | tatoeba | iteslj | ai */
  source: text().notNull(),
  /** A1 | A2 | B1 | B2 | C1 */
  level: text().notNull(),
  /** chủ đề người học chọn (AI) hoặc tên chủ đề iTESLj */
  topic: text(),
  /** số giây được nói mỗi câu */
  answerSeconds: integer('answer_seconds').notNull(),
  createdAt: createdAt(),
  finishedAt: integer('finished_at', { mode: 'timestamp' }),
})

export const reflexItems = sqliteTable(
  'reflex_items',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => reflexSessions.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    prompt: text().notNull(),
    /** vi | en: câu hỏi tiếng Anh thì đọc to */
    promptLang: text('prompt_lang').notNull(),
    hint: text(),
    /** câu mẫu */
    reference: text(),
    /** ghi nguồn câu (Tatoeba: tác giả + giấy phép) */
    attribution: text(),
    /** lời người học (nhận dạng giọng nói), null = chưa làm */
    transcript: text(),
    /** từ lúc hiện đề đến lúc bắt đầu nói */
    latencyMs: integer('latency_ms'),
    /** 0–10 */
    score: real(),
    feedback: text({ mode: 'json' }).$type<ReflexFeedback>(),
    /** bỏ qua câu này */
    skipped: integer({ mode: 'boolean' }).notNull().default(false),
    answeredAt: integer('answered_at', { mode: 'timestamp' }),
  },
  (t) => [index('reflex_items_session_idx').on(t.sessionId)],
)

/** chấm một câu phản xạ, cùng cấu trúc với ReflexGradeSchema (src/server/ai/prompts.ts) */
export interface ReflexFeedback {
  score: number
  meaningOk: boolean
  better: string
  corrections: Array<{
    said: string
    better: string
    type: string
    explanation: string
  }>
  tip: string
}

/** Tài liệu chunk người dùng tự nhập (PDF / văn bản của họ): chỉ lưu trên máy, không đưa vào seed */
export const userChunkImports = sqliteTable('user_chunk_imports', {
  id: integer().primaryKey({ autoIncrement: true }),
  /** tên hiển thị, vd. "The Book of Chunks (bản của tôi)" */
  label: text().notNull(),
  fileName: text('file_name').notNull(),
  /** queued | running | done | error */
  status: text().notNull().default('queued'),
  pages: integer().notNull().default(0),
  donePages: integer('done_pages').notNull().default(0),
  error: text(),
  createdAt: createdAt(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
})

export const userChunks = sqliteTable(
  'user_chunks',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    importId: integer('import_id')
      .notNull()
      .references(() => userChunkImports.id, { onDelete: 'cascade' }),
    text: text().notNull(),
    normalizedText: text('normalized_text').notNull(),
    /** nghĩa tiếng Việt AI gợi ý (chỉ dùng cá nhân) */
    meaningVi: text('meaning_vi'),
    /** câu ví dụ chép nguyên văn từ tài liệu, nếu có */
    exampleEn: text('example_en'),
    /** formula | sentence-frame | collocation | phrasal-verb | discourse-marker */
    kind: text().notNull(),
    page: integer(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('user_chunks_import_text_idx').on(t.importId, t.normalizedText),
    index('user_chunks_text_idx').on(t.normalizedText),
  ],
)

export interface RoadmapPhase {
  index: number
  title: string
  weeks: number
  targetLevel: string
  focus: string
  milestones: string[]
}

export interface RoadmapWeekPlan {
  week: number
  phaseIndex: number
  title: string
  theme: string
  level: string
  focusSkills: string[]
  searchKeywords: string[]
}

export interface RoadmapVideoMeta {
  source: 'library' | 'elllo' | 'youtube'
  url: string
  youtubeId?: string
  title: string
  channel?: string
  thumbnail?: string
  durationSec?: number
}

export interface RoadmapResourceMeta {
  kind:
    | 'grammar'
    | 'reading'
    | 'listening'
    | 'talk'
    | 'reflex'
    | 'speaking'
    | 'chunks'
    | 'ipa'
    | 'flashcards'
  unitId?: string
  unitTitle?: string
  unitGroup?: string
  /** flashcards: bộ thẻ theo chủ đề đã tạo cho nhiệm vụ này */
  deckId?: number
  source?: string
  url?: string
  itemTitle?: string
  scenario?: string
  reflexMode?: string
  soundId?: string
}

/** Lộ trình học cá nhân hoá (trang /roadmap) */
export const roadmaps = sqliteTable('roadmaps', {
  id: integer().primaryKey({ autoIncrement: true }),
  title: text().notNull(),
  goal: text().notNull(),
  currentLevel: text('current_level').notNull(),
  targetLevel: text('target_level').notNull(),
  durationMonths: integer('duration_months').notNull(),
  totalWeeks: integer('total_weeks').notNull(),
  dailyMinutes: integer('daily_minutes').notNull(),
  focusSkills: text('focus_skills', { mode: 'json' })
    .notNull()
    .$type<string[]>(),
  summary: text().notNull(),
  phases: text({ mode: 'json' }).notNull().$type<RoadmapPhase[]>(),
  weeks: text({ mode: 'json' }).notNull().$type<RoadmapWeekPlan[]>(),
  createdAt: createdAt(),
})

/** Nhiệm vụ từng ngày trong một tuần của lộ trình */
export const roadmapTasks = sqliteTable(
  'roadmap_tasks',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    roadmapId: integer('roadmap_id')
      .notNull()
      .references(() => roadmaps.id, { onDelete: 'cascade' }),
    weekNumber: integer('week_number').notNull(),
    dayNumber: integer('day_number').notNull(),
    dayTitle: text('day_title').notNull(),
    position: integer().notNull(),
    /** shadow | dictation | pronounce | listening | reading | grammar | talk | reflex | speaking | chunks | flashcards | ipa */
    activityType: text('activity_type').notNull(),
    title: text().notNull(),
    description: text().notNull(),
    durationMinutes: integer('duration_minutes').notNull(),
    level: text().notNull(),
    topic: text(),
    searchQuery: text('search_query'),
    preferredSource: text('preferred_source'),
    video: text({ mode: 'json' }).$type<RoadmapVideoMeta | null>(),
    resource: text({ mode: 'json' }).$type<RoadmapResourceMeta | null>(),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('roadmap_tasks_roadmap_week_idx').on(
      t.roadmapId,
      t.weekNumber,
      t.dayNumber,
    ),
  ],
)

export type Roadmap = typeof roadmaps.$inferSelect
export type RoadmapTask = typeof roadmapTasks.$inferSelect


/** Mỗi lượt gọi LLM: token dùng (do provider báo, hoặc ước lượng khi provider không trả) */
export const aiUsage = sqliteTable(
  'ai_usage',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    provider: text().notNull(),
    model: text().notNull(),
    /** tên tính năng gọi AI (roadmap, reading, …) */
    feature: text().notNull(),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    /** true = provider không báo usage, số token là ước lượng theo độ dài chữ */
    estimated: integer({ mode: 'boolean' }).notNull().default(false),
    ok: integer({ mode: 'boolean' }).notNull().default(true),
    durationMs: integer('duration_ms').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('ai_usage_created_idx').on(t.createdAt)],
)
