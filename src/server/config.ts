import { z } from 'zod'
import { db } from '#/db/index.ts'
import { settings } from '#/db/schema.ts'

export const LLM_PROVIDERS = [
  'openai',
  'anthropic',
  'gemini',
  'ollama',
  'openai-compatible',
] as const
/** Nói với AI: '' = dùng chung cấu hình LLM chính, hoặc chọn provider riêng */
export const TALK_PROVIDERS = ['', ...LLM_PROVIDERS] as const
/** llm-audio: model LLM nghe trực tiếp bản ghi âm · stt: Whisper rồi LLM đọc chữ */
export const PRONUNCIATION_ENGINES = ['llm-audio', 'stt'] as const
/** Tạo phụ đề cho video không có sẵn: local = whisper.cpp trên máy · api = STT API ở trên (tốn phí) */
export const CAPTION_ENGINES = ['local', 'api'] as const
/** model whisper.cpp chạy trên máy (chi tiết file trong whisper-local.ts) */
export const WHISPER_MODELS = ['large-v3-turbo', 'small.en'] as const
/** giọng dùng cho phiên âm IPA */
export const ACCENTS = ['us', 'uk'] as const
/** off: không tự gọi AI phân tích lỗi sau mỗi lần chấm, chỉ khi người dùng bấm */
export const AI_ANALYSIS = ['on', 'off'] as const
/** reasoning_effort gửi kèm request OpenAI / OpenAI-compatible; '' = không gửi, để model tự chọn */
export const REASONING_EFFORTS = ['', 'minimal', 'low', 'medium', 'high'] as const

export const AppConfigSchema = z.object({
  llmProvider: z.enum(LLM_PROVIDERS),
  llmModel: z.string().min(1),
  llmApiKey: z.string(),
  llmBaseUrl: z.string(),
  llmReasoningEffort: z.enum(REASONING_EFFORTS),
  talkProvider: z.enum(TALK_PROVIDERS),
  talkModel: z.string(),
  talkApiKey: z.string(),
  talkBaseUrl: z.string(),
  sttBaseUrl: z.string(),
  sttApiKey: z.string(),
  sttModel: z.string().min(1),
  pronunciationEngine: z.enum(PRONUNCIATION_ENGINES),
  captionEngine: z.enum(CAPTION_ENGINES),
  whisperModel: z.enum(WHISPER_MODELS),
  accent: z.enum(ACCENTS),
  aiAnalysis: z.enum(AI_ANALYSIS),
  /** thẻ từ: số từ mới tối đa mỗi ngày (mặc định như Anki) */
  newPerDay: z.coerce.number().int().min(0).max(1000),
  /** thẻ từ: số lượt ôn (thẻ đến hạn) tối đa mỗi ngày */
  reviewsPerDay: z.coerce.number().int().min(0).max(9999),
  /** sách từ vựng: unit dài chia thành các bộ tối đa chừng này từ */
  wordsPerGroup: z.coerce.number().int().min(5).max(200),
  /** thống kê: số lượt luyện mỗi ngày để tính "đạt mục tiêu" (câu chép, lượt nói, lượt ôn thẻ, câu ngữ pháp) */
  dailyGoal: z.coerce.number().int().min(1).max(500),
  /** Nói theo đề: giây chuẩn bị trước khi ghi âm (0 = nói ngay) */
  speakPrepSeconds: z.coerce.number().int().min(0).max(300),
  /** Nói theo đề: giây nói tối đa, hết giờ tự nộp bài */
  speakMaxSeconds: z.coerce.number().int().min(30).max(600),
  /** Nhập vai / IELTS Part 1, 3: giây tối đa mỗi lượt nói */
  talkTurnSeconds: z.coerce.number().int().min(10).max(600),
})
export type AppConfig = z.infer<typeof AppConfigSchema>
export type WhisperModel = (typeof WHISPER_MODELS)[number]

type TalkFields = Pick<
  AppConfig,
  'talkProvider' | 'talkModel' | 'talkApiKey' | 'talkBaseUrl'
>

function talkFromEnv(e: NodeJS.ProcessEnv): TalkFields {
  if ((TALK_PROVIDERS as readonly string[]).includes(e.TALK_PROVIDER ?? '-'))
    return {
      talkProvider: e.TALK_PROVIDER as AppConfig['talkProvider'],
      talkModel: e.TALK_MODEL ?? '',
      talkApiKey: e.TALK_API_KEY ?? '',
      talkBaseUrl: e.TALK_BASE_URL ?? '',
    }
  // biến cũ TALK_VILAO_* (Vilao là OpenAI-compatible)
  if (e.TALK_VILAO_API_KEY)
    return {
      talkProvider: 'openai-compatible',
      talkModel: e.TALK_VILAO_MODEL ?? 'chib/gemini-3.8-flash',
      talkApiKey: e.TALK_VILAO_API_KEY,
      talkBaseUrl: e.TALK_VILAO_BASE_URL ?? 'https://api.vilao.ai/v1',
    }
  return { talkProvider: '', talkModel: '', talkApiKey: '', talkBaseUrl: '' }
}

/** Setting cũ talkVilao* đã lưu ở /settings → cấu hình Nói với AI dạng OpenAI-compatible */
function legacyTalk(values: Record<string, string>): Partial<TalkFields> {
  if (!values.talkVilaoApiKey) return {}
  return {
    talkProvider: 'openai-compatible',
    talkApiKey: values.talkVilaoApiKey,
    talkBaseUrl: values.talkVilaoBaseUrl || 'https://api.vilao.ai/v1',
    talkModel: values.talkVilaoModel || 'chib/gemini-3.8-flash',
  }
}

function fromEnv(): AppConfig {
  const e = process.env
  return {
    llmProvider: (LLM_PROVIDERS as readonly string[]).includes(
      e.LLM_PROVIDER ?? '',
    )
      ? (e.LLM_PROVIDER as AppConfig['llmProvider'])
      : 'openai',
    llmModel: e.LLM_MODEL ?? 'gpt-5-mini',
    llmApiKey: e.LLM_API_KEY ?? e.OPENAI_API_KEY ?? '',
    llmBaseUrl: e.LLM_BASE_URL ?? '',
    llmReasoningEffort: (REASONING_EFFORTS as readonly string[]).includes(
      e.LLM_REASONING_EFFORT ?? '',
    )
      ? (e.LLM_REASONING_EFFORT as AppConfig['llmReasoningEffort'])
      : '',
    ...talkFromEnv(e),
    sttBaseUrl: e.STT_BASE_URL ?? '',
    sttApiKey: e.STT_API_KEY ?? e.OPENAI_API_KEY ?? '',
    sttModel: e.STT_MODEL ?? 'whisper-1',
    pronunciationEngine: e.PRONUNCIATION_ENGINE === 'stt' ? 'stt' : 'llm-audio',
    captionEngine: e.CAPTION_ENGINE === 'api' ? 'api' : 'local',
    whisperModel:
      e.WHISPER_MODEL === 'small.en' ? 'small.en' : 'large-v3-turbo',
    accent: e.ACCENT === 'uk' ? 'uk' : 'us',
    aiAnalysis: e.AI_ANALYSIS === 'off' ? 'off' : 'on',
    newPerDay: 20,
    reviewsPerDay: 200,
    wordsPerGroup: 25,
    dailyGoal: 20,
    speakPrepSeconds: 60,
    speakMaxSeconds: 120,
    talkTurnSeconds: 45,
  }
}

/** Cấu hình hiện hành: giá trị lưu ở trang /settings ghi đè .env */
export function getConfig(): AppConfig {
  const base = fromEnv()
  const rows = db.select().from(settings).all()
  const overrides: Record<string, string> = Object.fromEntries(
    rows.filter((r) => r.value !== '').map((r) => [r.key, r.value]),
  )
  const talkRow = rows.find((r) => r.key === 'talkProvider')
  if (talkRow) overrides.talkProvider = talkRow.value // '' = dùng chung LLM chính, vẫn là lựa chọn hợp lệ
  else Object.assign(overrides, legacyTalk(overrides))
  const merged = AppConfigSchema.safeParse({ ...base, ...overrides })
  return merged.success ? merged.data : base
}

export function saveConfig(patch: Partial<AppConfig>) {
  for (const [key, value] of Object.entries(patch) as Array<
    [string, string | undefined]
  >) {
    if (value === undefined) continue
    db.insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: String(value) },
      })
      .run()
  }
}

/** Trả về cấu hình cho client: che API key */
export function publicConfig(cfg: AppConfig) {
  const mask = (k: string) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : '')
  return {
    ...cfg,
    llmApiKey: mask(cfg.llmApiKey),
    sttApiKey: mask(cfg.sttApiKey),
    talkApiKey: mask(cfg.talkApiKey),
  }
}

/** Đã cấu hình LLM (Ollama / OpenAI-compatible chạy local không cần key) */
export function hasLlm(cfg: AppConfig): boolean {
  if (cfg.llmProvider === 'ollama') return true
  if (cfg.llmProvider === 'openai-compatible') return !!cfg.llmBaseUrl
  return !!cfg.llmApiKey
}

/** Cấu hình LLM cho Nói với AI: provider riêng nếu có chọn, không thì dùng chung LLM chính */
export function talkLlmConfig(cfg: AppConfig = getConfig()): AppConfig {
  const talk: AppConfig = cfg.talkProvider
    ? {
        ...cfg,
        llmProvider: cfg.talkProvider,
        llmModel: cfg.talkModel.trim(),
        llmApiKey: cfg.talkApiKey,
        llmBaseUrl: cfg.talkBaseUrl,
      }
    : cfg
  if (!hasLlm(talk) || !talk.llmModel)
    throw new Error(
      cfg.talkProvider
        ? 'Chưa cấu hình đủ provider cho Nói với AI trong Cài đặt'
        : 'Chưa cấu hình mô hình ngôn ngữ trong Cài đặt',
    )
  return talk
}

/** LLM nghe được audio trực tiếp (gửi `input_audio` qua API tương thích OpenAI) */
export function hasAudioLlm(cfg: AppConfig): boolean {
  return (
    cfg.llmProvider !== 'anthropic' &&
    cfg.llmProvider !== 'ollama' &&
    hasLlm(cfg)
  )
}

export function hasStt(cfg: AppConfig): boolean {
  return !!(cfg.sttApiKey || cfg.sttBaseUrl)
}
