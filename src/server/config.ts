import { z } from 'zod'
import { db } from '#/db/index.ts'
import { settings } from '#/db/schema.ts'

export const LLM_PROVIDERS = ['openai', 'anthropic', 'gemini', 'ollama', 'openai-compatible'] as const
/** llm-audio: model LLM nghe trực tiếp bản ghi âm · stt: Whisper rồi LLM đọc chữ */
export const PRONUNCIATION_ENGINES = ['llm-audio', 'stt'] as const
/** Tạo phụ đề cho video không có sẵn: local = whisper.cpp trên máy · api = STT API ở trên (tốn phí) */
export const CAPTION_ENGINES = ['local', 'api'] as const
/** giọng dùng cho phiên âm IPA */
export const ACCENTS = ['us', 'uk'] as const
/** off: không tự gọi AI phân tích lỗi sau mỗi lần chấm, chỉ khi người dùng bấm */
export const AI_ANALYSIS = ['on', 'off'] as const

export const AppConfigSchema = z.object({
  llmProvider: z.enum(LLM_PROVIDERS),
  llmModel: z.string().min(1),
  llmApiKey: z.string(),
  llmBaseUrl: z.string(),
  sttBaseUrl: z.string(),
  sttApiKey: z.string(),
  sttModel: z.string().min(1),
  pronunciationEngine: z.enum(PRONUNCIATION_ENGINES),
  captionEngine: z.enum(CAPTION_ENGINES),
  accent: z.enum(ACCENTS),
  aiAnalysis: z.enum(AI_ANALYSIS),
  /** thẻ từ: số từ mới tối đa mỗi ngày (mặc định như Anki) */
  newPerDay: z.coerce.number().int().min(0).max(1000),
  /** thẻ từ: số lượt ôn (thẻ đến hạn) tối đa mỗi ngày */
  reviewsPerDay: z.coerce.number().int().min(0).max(9999),
  /** sách từ vựng: unit dài chia thành các bộ tối đa chừng này từ */
  wordsPerGroup: z.coerce.number().int().min(5).max(200),
})
export type AppConfig = z.infer<typeof AppConfigSchema>

function fromEnv(): AppConfig {
  const e = process.env
  return {
    llmProvider: (LLM_PROVIDERS as readonly string[]).includes(e.LLM_PROVIDER ?? '')
      ? (e.LLM_PROVIDER as AppConfig['llmProvider'])
      : 'openai',
    llmModel: e.LLM_MODEL ?? 'gpt-5-mini',
    llmApiKey: e.LLM_API_KEY ?? e.OPENAI_API_KEY ?? '',
    llmBaseUrl: e.LLM_BASE_URL ?? '',
    sttBaseUrl: e.STT_BASE_URL ?? '',
    sttApiKey: e.STT_API_KEY ?? e.OPENAI_API_KEY ?? '',
    sttModel: e.STT_MODEL ?? 'whisper-1',
    pronunciationEngine: e.PRONUNCIATION_ENGINE === 'stt' ? 'stt' : 'llm-audio',
    captionEngine: e.CAPTION_ENGINE === 'api' ? 'api' : 'local',
    accent: e.ACCENT === 'uk' ? 'uk' : 'us',
    aiAnalysis: e.AI_ANALYSIS === 'off' ? 'off' : 'on',
    newPerDay: 20,
    reviewsPerDay: 200,
    wordsPerGroup: 25,
  }
}

/** Cấu hình hiện hành: giá trị lưu ở trang /settings ghi đè .env */
export function getConfig(): AppConfig {
  const base = fromEnv()
  const rows = db.select().from(settings).all()
  const overrides = Object.fromEntries(rows.filter((r) => r.value !== '').map((r) => [r.key, r.value]))
  const merged = AppConfigSchema.safeParse({ ...base, ...overrides })
  return merged.success ? merged.data : base
}

export function saveConfig(patch: Partial<AppConfig>) {
  for (const [key, value] of Object.entries(patch) as Array<[string, string | undefined]>) {
    if (value === undefined) continue
    db.insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } })
      .run()
  }
}

/** Trả về cấu hình cho client: che API key */
export function publicConfig(cfg: AppConfig) {
  const mask = (k: string) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : '')
  return { ...cfg, llmApiKey: mask(cfg.llmApiKey), sttApiKey: mask(cfg.sttApiKey) }
}

/** Đã cấu hình LLM (Ollama / OpenAI-compatible chạy local không cần key) */
export function hasLlm(cfg: AppConfig): boolean {
  if (cfg.llmProvider === 'ollama') return true
  if (cfg.llmProvider === 'openai-compatible') return !!cfg.llmBaseUrl
  return !!cfg.llmApiKey
}

/** LLM nghe được audio trực tiếp (gửi `input_audio` qua API tương thích OpenAI) */
export function hasAudioLlm(cfg: AppConfig): boolean {
  return cfg.llmProvider !== 'anthropic' && cfg.llmProvider !== 'ollama' && hasLlm(cfg)
}

export function hasStt(cfg: AppConfig): boolean {
  return !!(cfg.sttApiKey || cfg.sttBaseUrl)
}
