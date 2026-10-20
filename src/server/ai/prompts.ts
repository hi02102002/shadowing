import { z } from 'zod'
import type { AlignToken } from '#/lib/align.ts'
import type { Accent } from '#/lib/speech.ts'

export const MISTAKE_TYPES = [
  'weak_form', // dạng yếu: to → /tə/, and → /ən/
  'linking', // nối âm: turn it off → tur-ni-toff
  'elision', // nuốt âm: next day → nex day
  'contraction', // rút gọn: I'd, gonna
  'homophone', // đồng âm: their/there
  'ending_sound', // âm cuối: -s, -ed, -t
  'vowel', // nguyên âm
  'consonant', // phụ âm (th, v/w, r/l…)
  'stress', // trọng âm
  'vocabulary', // từ chưa biết
  'spelling', // nghe đúng nhưng viết sai chính tả
  'grammar', // nghe sai do suy đoán ngữ pháp
  'other',
] as const

export const MISTAKE_TYPE_LABELS: Record<
  (typeof MISTAKE_TYPES)[number],
  string
> = {
  weak_form: 'Dạng yếu',
  linking: 'Nối âm',
  elision: 'Nuốt âm',
  contraction: 'Rút gọn',
  homophone: 'Đồng âm',
  ending_sound: 'Âm cuối',
  vowel: 'Nguyên âm',
  consonant: 'Phụ âm',
  stress: 'Trọng âm',
  vocabulary: 'Từ vựng',
  spelling: 'Chính tả',
  grammar: 'Ngữ pháp',
  other: 'Khác',
}

/** Nhãn tiếng Việt cho type lỗi (type lạ từ DB cũ thì trả nguyên) */
export function mistakeLabel(type: string): string {
  return (
    (MISTAKE_TYPE_LABELS as Record<string, string | undefined>)[type] ?? type
  )
}

const MistakeSchema = z.object({
  word: z.string().describe('từ/cụm từ đúng trong câu gốc'),
  heard: z.string().describe('những gì người học viết/nói, rỗng nếu bỏ sót'),
  type: z.enum(MISTAKE_TYPES),
  ipa: z.string().describe('phiên âm IPA của từ/cụm từ đúng, ví dụ /ˈwɔːtər/'),
  explanation: z
    .string()
    .describe('giải thích ngắn gọn bằng tiếng Việt vì sao bị sai'),
  tip: z.string().describe('mẹo luyện tập cụ thể bằng tiếng Việt'),
})

export const DictationAnalysisSchema = z.object({
  summary: z.string().describe('nhận xét tổng quan 1-2 câu bằng tiếng Việt'),
  mistakes: z.array(MistakeSchema),
  connectedSpeech: z
    .array(
      z.object({
        phrase: z.string(),
        sounds_like: z
          .string()
          .describe('cách cụm từ thực sự được phát âm khi nói nhanh'),
        note: z.string(),
      }),
    )
    .describe('các hiện tượng nối âm / nuốt âm đáng chú ý trong câu, tối đa 3'),
})
export type DictationAnalysis = z.infer<typeof DictationAnalysisSchema>

export const PronunciationFeedbackSchema = z.object({
  summary: z
    .string()
    .describe(
      'nhận xét tổng quan 1-2 câu bằng tiếng Việt, động viên nhưng thẳng thắn',
    ),
  fluency: z.number().min(0).max(100).describe('ước lượng độ trôi chảy 0-100'),
  mistakes: z.array(MistakeSchema),
  drills: z
    .array(z.string())
    .describe('2-3 bài tập ngắn để luyện lại, bằng tiếng Việt'),
})
export type PronunciationFeedback = z.infer<typeof PronunciationFeedbackSchema>

const BASE_SYSTEM = `Bạn là giáo viên phát âm và nghe tiếng Anh giàu kinh nghiệm, dạy người Việt.
- Luôn trả lời bằng tiếng Việt, ngắn gọn, cụ thể, dễ hiểu.
- Hiểu rõ các lỗi đặc trưng của người Việt: bỏ âm cuối (-s, -ed, -t, -k), nhầm /θ/ /ð/ với /t/ /d/ /z/, /v/ vs /w/, /ʃ/ vs /s/, /l/ vs /n/ cuối, không bật hơi, không có trọng âm, đọc từng từ rời rạc.
- Hiểu connected speech: weak forms, linking, elision, assimilation, flap T.
- Chỉ liệt kê lỗi thực sự có trong dữ liệu, không bịa thêm.`

const ACCENT_NAME: Record<Accent, string> = {
  us: 'giọng Mỹ (General American)',
  uk: 'giọng Anh-Anh (British RP)',
}

/** giọng chuẩn người học chọn trong Cài đặt: IPA, mẹo khẩu hình và cách chấm đều theo giọng này */
export const accentRule = (accent: Accent) =>
  `- Lấy ${ACCENT_NAME[accent]} làm chuẩn: phiên âm IPA, hướng dẫn phát âm và đánh giá đều theo giọng này. Không tính là lỗi nếu người học đọc đúng theo giọng chuẩn còn lại.`

export const dictationSystem = (accent: Accent) => `${BASE_SYSTEM}
${accentRule(accent)}
Nhiệm vụ: phân tích bài nghe chép chính tả. Với mỗi từ sai/thiếu/thừa, xác định NGUYÊN NHÂN NGHE nhầm (vì sao tai người học nghe ra như vậy) và phân loại vào một type.
Nếu người học nghe đúng âm nhưng viết sai chính tả, dùng type "spelling". Gộp các lỗi liên tiếp thuộc cùng một cụm thành một mục.`

export const pronunciationSystem = (accent: Accent) => `${BASE_SYSTEM}
${accentRule(accent)}
Nhiệm vụ: nhận xét phát âm dựa trên kết quả nhận dạng giọng nói (speech-to-text) của người học so với câu gốc.
Lưu ý: STT có thể "tự sửa" một số lỗi nhỏ, nên những từ bị nhận dạng sai/thiếu là dấu hiệu phát âm chưa rõ. Suy luận âm nào người học có khả năng phát âm sai và hướng dẫn khẩu hình/vị trí lưỡi.
Đánh giá fluency dựa trên tốc độ nói và các khoảng ngắt giữa các từ.`

export function tokensForPrompt(tokens: AlignToken[]) {
  return tokens
    .filter((t) => t.op !== 'correct')
    .map((t) =>
      t.op === 'missing'
        ? `- THIẾU: "${t.ref}"`
        : t.op === 'extra'
          ? `- THỪA: "${t.hyp}"`
          : `- SAI: gốc "${t.ref}" → người học "${t.hyp}"`,
    )
    .join('\n')
}

export function dictationPrompt(
  reference: string,
  input: string,
  tokens: AlignToken[],
  context?: string,
) {
  return `Câu gốc: "${reference}"
Người học viết: "${input}"
${context ? `Ngữ cảnh (câu trước): "${context}"\n` : ''}
Các chỗ khác biệt (đã căn chỉnh tự động):
${tokensForPrompt(tokens) || '(không có — người học viết đúng hoàn toàn)'}

Hãy phân tích lỗi và chỉ ra các hiện tượng connected speech trong câu gốc giúp người học nghe tốt hơn.`
}

export function pronunciationPrompt(opts: {
  reference: string
  transcript: string
  tokens: AlignToken[]
  wpm: number | null
  refWpm: number | null
  pauses: Array<{ after: string; ms: number }>
}) {
  return `Câu gốc: "${opts.reference}"
STT nhận dạng người học nói: "${opts.transcript}"
Tốc độ người học: ${opts.wpm ?? '?'} từ/phút (bản gốc: ${opts.refWpm ?? '?'} từ/phút)
Các khoảng ngắt dài (>400ms): ${opts.pauses.map((p) => `sau "${p.after}" ${p.ms}ms`).join(', ') || 'không có'}

Các chỗ khác biệt:
${tokensForPrompt(opts.tokens) || '(STT nhận dạng đúng toàn bộ)'}

Hãy nhận xét phát âm, chỉ ra lỗi và đưa bài tập luyện lại.`
}

/** Kết quả khi model LLM nghe trực tiếp bản ghi âm: chữ nghe được + nhận xét trong một lần gọi */
export const AudioAssessmentSchema = PronunciationFeedbackSchema.extend({
  transcript: z
    .string()
    .describe(
      'chép lại CHÍNH XÁC những gì người học nói, kể cả từ sai/thiếu/thừa; không sửa theo câu gốc',
    ),
})
export type AudioAssessment = z.infer<typeof AudioAssessmentSchema>

export const audioPronunciationSystem = (accent: Accent) => `${BASE_SYSTEM}
${accentRule(accent)}
Nhiệm vụ: bạn được nghe trực tiếp bản ghi âm người học đọc một câu tiếng Anh, kèm câu gốc.
1. "transcript": chép lại đúng những gì nghe được. TUYỆT ĐỐI không tự sửa theo câu gốc. Nếu một từ bị phát âm sai đến mức nghe thành từ khác, ghi từ nghe được. Bỏ âm cuối (ví dụ "work" thay vì "works") thì ghi đúng như vậy.
2. "mistakes": chỉ ra các âm/từ phát âm chưa chuẩn mà bạn THỰC SỰ nghe thấy: âm cuối, nguyên âm, phụ âm, trọng âm, nối âm. Có thể nêu cả lỗi ở những từ vẫn nghe ra được nhưng phát âm chưa tự nhiên.
3. "fluency": độ trôi chảy 0-100 dựa trên nhịp, ngắt nghỉ và ngữ điệu so với người bản xứ.
Nếu bản ghi im lặng hoặc không nghe rõ, để transcript rỗng và nói rõ trong summary.`

export function audioPronunciationPrompt(reference: string) {
  return `Câu gốc người học cần đọc: "${reference}"
Hãy nghe bản ghi âm đính kèm và đánh giá phát âm.`
}

export const LookupSchema = z.object({
  headword: z
    .string()
    .describe('dạng từ điển của từ/cụm từ (vd. "practices" → "practice")'),
  ipa: z.string().describe('IPA giọng Anh-Anh (British RP), vd. /ˈwɔːtə/'),
  ipaUs: z.string().describe('IPA giọng Mỹ (General American), vd. /ˈwɑːtər/'),
  partOfSpeech: z
    .string()
    .describe(
      'từ loại trong câu này, bằng tiếng Việt: danh từ, động từ, tính từ, cụm động từ…',
    ),
  meaningInContext: z
    .string()
    .describe('nghĩa tiếng Việt CHÍNH XÁC trong câu đã cho, ngắn gọn'),
  otherMeanings: z
    .array(z.string())
    .describe('tối đa 3 nghĩa phổ biến khác (tiếng Việt), có thể rỗng'),
  definitionEn: z
    .string()
    .describe('định nghĩa tiếng Anh đơn giản (trình độ B1)'),
  examples: z
    .array(z.object({ en: z.string(), vi: z.string() }))
    .describe('2 câu ví dụ ngắn, tự nhiên, kèm bản dịch'),
  pronunciationTip: z
    .string()
    .describe(
      'mẹo phát âm cho người Việt (trọng âm, âm cuối, âm dễ sai), rỗng nếu không có gì đáng chú ý',
    ),
})
export type Lookup = z.infer<typeof LookupSchema>

export const LOOKUP_SYSTEM = `Bạn là từ điển Anh–Việt dành cho người Việt học tiếng Anh.
- Giải thích nghĩa của từ/cụm từ ĐÚNG THEO NGỮ CẢNH câu được cung cấp.
- Viết tiếng Việt tự nhiên, ngắn gọn. Cho IPA cả giọng Anh-Anh (RP) và giọng Mỹ.
- Ví dụ phải là câu do bạn tự đặt, không trích nguyên văn từ nguồn có bản quyền.`

export function lookupPrompt(text: string, sentence: string) {
  return `Từ/cụm từ cần tra: "${text}"
Câu ngữ cảnh: "${sentence}"`
}
