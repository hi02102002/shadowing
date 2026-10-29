import { z } from 'zod'
import type { AlignToken } from '#/lib/align.ts'
import type { TalkLevel } from '#/lib/conversation.ts'
import type { SpeakingTarget } from '#/lib/speaking-topics.ts'
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

export const GrammarExplainSchema = z.object({
  summary: z.string().describe('ý chính của mục ngữ pháp này trong 1-2 câu tiếng Việt'),
  points: z
    .array(
      z.object({
        rule: z.string().describe('một quy tắc / cách dùng, giải thích bằng tiếng Việt dễ hiểu'),
        examples: z
          .array(z.object({ en: z.string(), vi: z.string() }))
          .describe('1-2 câu ví dụ tiếng Anh ngắn, tự đặt, kèm bản dịch'),
      }),
    )
    .describe('2-5 điểm chính'),
  pitfalls: z
    .array(z.string())
    .describe('lỗi người Việt hay mắc với cấu trúc này (tiếng Việt), có thể rỗng'),
})
export type GrammarExplain = z.infer<typeof GrammarExplainSchema>

export const GrammarMistakeSchema = z.object({
  explanation: z
    .string()
    .describe('vì sao câu trả lời của người học sai và vì sao đáp án đúng, bằng tiếng Việt, 2-4 câu'),
  tip: z.string().describe('mẹo ngắn để lần sau không sai, bằng tiếng Việt'),
})
export type GrammarMistake = z.infer<typeof GrammarMistakeSchema>

export const GRAMMAR_SYSTEM = `Bạn là giáo viên ngữ pháp tiếng Anh giàu kinh nghiệm, dạy người Việt.
- Luôn trả lời bằng tiếng Việt, ngắn gọn, cụ thể; giữ nguyên thuật ngữ và ví dụ tiếng Anh khi cần.
- So sánh với tiếng Việt khi giúp người học hiểu (tiếng Việt không chia thì, không có mạo từ…).
- Ví dụ phải là câu do bạn tự đặt, không chép nguyên văn từ sách.`

export function grammarSectionPrompt(unitTitle: string, label: string, text: string) {
  return `Bài: ${unitTitle}
Mục ${label} trong sách (tiếng Anh):
"""
${text}
"""
Hãy giảng lại mục này bằng tiếng Việt cho người học trình độ trung cấp.`
}

export function grammarAnswerPrompt(opts: {
  unitTitle: string
  exercise: string
  question: string
  expected: string
  answer: string
}) {
  return `Bài: ${opts.unitTitle}
Yêu cầu bài tập: ${opts.exercise}
Câu hỏi (chỗ cần điền là ___):
"""
${opts.question}
"""
Đáp án đúng: ${opts.expected}
Người học trả lời: ${opts.answer || '(bỏ trống)'}`
}

/** độ khó bài tập ngữ pháp do AI tạo */
export const DRILL_LEVELS = ['easy', 'medium', 'hard'] as const
export type DrillLevel = (typeof DRILL_LEVELS)[number]

const DRILL_LEVEL_DESC: Record<DrillLevel, string> = {
  easy: 'DỄ (A2): câu ngắn một mệnh đề, từ vựng thông dụng, dùng dạng cơ bản nhất của cấu trúc, ngữ cảnh rõ ràng.',
  medium:
    'VỪA (B1): câu có ngữ cảnh 1–2 mệnh đề, trộn khẳng định / phủ định / nghi vấn, có câu cần phân biệt với cấu trúc dễ nhầm.',
  hard: 'KHÓ (B2–C1): ngữ cảnh dài hơn, câu phức, trường hợp đặc biệt / ngoại lệ, phân biệt tinh tế với cấu trúc gần giống, bẫy người Việt hay mắc.',
}

/** dạng bài tập AI tạo */
export const DRILL_TYPES = ['fill', 'choice', 'fix', 'order', 'rewrite'] as const
export type DrillType = (typeof DRILL_TYPES)[number]

const DRILL_TYPE_DESC: Record<DrillType, string> = {
  fill: '"fill" — điền vào chỗ trống: prompt là câu có đúng một ___, hint là từ gợi ý trong ngoặc như "(go)", answers là mọi cách điền đúng',
  choice:
    '"choice" — trắc nghiệm: prompt là câu có đúng một ___, options 3–4 phương án (phương án sai là lỗi người học hay mắc), answers là đúng một phương án chép nguyên văn',
  fix: '"fix" — tìm và sửa lỗi: prompt là câu có ĐÚNG MỘT lỗi ngữ pháp thuộc chủ điểm (không có ___), wrong là phần sai chép nguyên văn trong prompt, answers là các cách sửa phần đó',
  order:
    '"order" — sắp xếp từ thành câu: prompt là nghĩa tiếng Việt của câu, answers[0] là câu tiếng Anh đúng 4–12 từ (các phần tử khác nếu có là cách sắp xếp khác cũng đúng)',
  rewrite:
    '"rewrite" — viết lại câu: prompt là câu gốc tiếng Anh, hint là yêu cầu bằng tiếng Việt kèm từ gợi ý (vd. \'Dùng "since"\', \'Bắt đầu bằng "She has…"\'), answers là mọi câu viết lại đúng, đầy đủ',
}

export const GrammarDrillSchema = z.object({
  questions: z
    .array(
      z.object({
        type: z.enum(DRILL_TYPES),
        prompt: z.string(),
        hint: z.string().describe('rỗng nếu dạng bài không cần'),
        options: z.array(z.string()).describe('chỉ dạng choice, các dạng khác là mảng rỗng'),
        wrong: z.string().describe('chỉ dạng fix, các dạng khác là chuỗi rỗng'),
        answers: z.array(z.string()),
        explanation: z.string().describe('giải thích tiếng Việt 1–2 câu vì sao đáp án đúng'),
      }),
    )
    .describe('đúng số câu được yêu cầu, chia đều các dạng được yêu cầu, xếp xen kẽ'),
})
export type GrammarDrill = z.infer<typeof GrammarDrillSchema>

export function grammarDrillPrompt(opts: {
  unitTitle: string
  theory: string
  level: DrillLevel
  count: number
  types: readonly DrillType[]
  /** nhóm chủ đề cho lượt này khi chia nhiều lượt gọi (để các lượt không trùng câu) */
  themes?: string
}) {
  return `Bài: ${opts.unitTitle}
Lý thuyết trong sách (tiếng Anh):
"""
${opts.theory}
"""
Hãy tạo ${opts.count} câu bài tập mới luyện ĐÚNG chủ điểm của bài này, độ khó ${DRILL_LEVEL_DESC[opts.level]}
Chỉ dùng các dạng sau, chia đều số câu:
${opts.types.map((t) => `- ${DRILL_TYPE_DESC[t]}`).join('\n')}
Yêu cầu chung:
- Tự đặt câu với chủ đề ${opts.themes ? `xoay quanh: ${opts.themes}` : 'đời thường đa dạng'}, không chép ví dụ trong sách, không lặp cấu trúc câu.
- Mỗi câu chỉ có một cách hiểu đúng (trừ các dạng viết tương đương liệt kê trong answers, kể cả dạng rút gọn như "'s gone").`
}

export const PHRASE_KINDS = ['phrasal verb', 'idiom', 'collocation', 'expression'] as const
/** từ loại theo ngữ cảnh câu (khớp nhãn POS_VI trong src/lib/levels.ts) */
export const WORD_POS = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'determiner', 'interjection'] as const

export const VideoPhrasesSchema = z.object({
  phrases: z
    .array(
      z.object({
        phrase: z.string().describe('dạng từ điển của cụm, vd. "pick up", "make a decision", "break the ice"'),
        kind: z.enum(PHRASE_KINDS),
        level: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).describe('cấp CEFR ước lượng của cụm'),
        meaningVi: z.string().describe('nghĩa tiếng Việt ngắn gọn, đúng theo ngữ cảnh câu'),
        segment: z.number().int().describe('số thứ tự [n] của câu chứa cụm'),
        surface: z
          .string()
          .describe('nguyên văn cụm đúng như trong câu đó (giữ dạng chia), vd. "picked you up"'),
      }),
    )
    .describe('tối đa 30 cụm đáng học, theo thứ tự xuất hiện'),
  words: z
    .array(z.object({ word: z.string(), pos: z.enum(WORD_POS) }))
    .describe('từ loại của MỖI từ trong danh sách "Từ cần xác định từ loại", theo nghĩa trong câu đã cho'),
})
export type VideoPhrases = z.infer<typeof VideoPhrasesSchema>

export const VIDEO_PHRASES_SYSTEM = `Bạn giúp người Việt học tiếng Anh qua video.
1. Từ transcript, liệt kê các CỤM TỪ đáng học: phrasal verb, thành ngữ, collocation, cách nói cố định.
- Chỉ lấy cụm có thật trong transcript, KHÔNG lấy từ đơn, bỏ cụm quá cơ bản (cấp A1 như "go to", "a lot of").
- "segment" là số trong ngoặc vuông của câu chứa cụm (lần xuất hiện đầu tiên).
- "surface" phải chép nguyên văn từ câu đó để có thể tìm thấy bằng so khớp chuỗi.
2. Với danh sách từ cần xác định từ loại (mỗi dòng: từ gốc | dạng trong câu | số câu), cho từ loại của từ
   ĐÚNG THEO CÁCH DÙNG trong câu đó (vd. "view" trong "a nice view" là noun, trong "view the page" là verb).
   "word" chép đúng từ gốc.`

export function videoPhrasesPrompt(lines: string, words: string) {
  return `Transcript (mỗi dòng: [số thứ tự] câu):\n${lines}\n\nTừ cần xác định từ loại:\n${words || '(không có)'}`
}

const TALK_LEVEL_DESC: Record<TalkLevel, string> = {
  A2: 'A2 (elementary): very short simple sentences, everyday words only, speak slowly and clearly, no idioms.',
  B1: 'B1 (intermediate): short natural sentences, common phrasal verbs are fine, avoid rare words.',
  B2: 'B2 (upper-intermediate): natural everyday English with common idioms and varied structures.',
}

export const ConversationReplySchema = z.object({
  reply: z.string().describe('your next line in the role-play, in English'),
  hints: z
    .array(z.string())
    .describe('2 short, different English replies the learner could say next, at their level'),
})
export type ConversationReply = z.infer<typeof ConversationReplySchema>

/** vai AI trong buổi hội thoại; prompt viết tiếng Anh để AI trả lời tự nhiên bằng tiếng Anh */
export const conversationSystem = (topic: string, level: TalkLevel) => `You are an English conversation partner for a Vietnamese learner, doing a spoken role-play.
Scenario: ${topic}
Learner level: ${TALK_LEVEL_DESC[level]}
Rules:
- Stay in your role. Reply in English only, 1–3 short sentences (under 40 words), because your reply is read aloud.
- Keep the conversation going: usually end with a question or a natural prompt for the learner.
- Do NOT correct the learner's mistakes during the conversation; feedback comes at the end. Just respond naturally to what they meant.
- The learner's lines come from speech recognition and may contain recognition errors: guess the intended meaning.
- If the learner writes Vietnamese or seems stuck, help gently in simple English and keep going.
- No emojis, no markdown, no stage directions.`

/** lịch sử hội thoại dạng kịch bản cho prompt */
export function conversationTranscript(turns: Array<{ role: string; text: string }>) {
  return turns.map((t) => `${t.role === 'ai' ? 'You' : 'Learner'}: ${t.text}`).join('\n')
}

export function conversationPrompt(turns: Array<{ role: string; text: string }>) {
  return turns.length
    ? `Conversation so far:\n${conversationTranscript(turns)}\n\nWrite your next line.`
    : 'Start the conversation with a natural opening line for this scenario.'
}

export const CONVERSATION_MISTAKE_TYPES = ['grammar', 'vocabulary', 'other'] as const

export const ConversationFeedbackSchema = z.object({
  summary: z
    .string()
    .describe('nhận xét tổng quan 2-3 câu bằng tiếng Việt: điểm tốt, điểm cần cải thiện'),
  corrections: z
    .array(
      z.object({
        said: z.string().describe('nguyên văn phần người học nói sai hoặc chưa tự nhiên'),
        better: z.string().describe('cách nói đúng, tự nhiên bằng tiếng Anh'),
        type: z.enum(CONVERSATION_MISTAKE_TYPES),
        explanation: z.string().describe('giải thích ngắn bằng tiếng Việt'),
      }),
    )
    .describe('tối đa 8 lỗi quan trọng nhất, theo thứ tự xuất hiện; rỗng nếu không có lỗi'),
  phrases: z
    .array(z.object({ en: z.string(), vi: z.string().describe('nghĩa tiếng Việt') }))
    .describe('3-6 cụm từ hữu ích cho tình huống này người học nên dùng lần sau'),
})

export const CONVERSATION_FEEDBACK_SYSTEM = `${GRAMMAR_SYSTEM}
- Bạn đang nhận xét một buổi hội thoại nhập vai bằng tiếng Anh của người học.
- Lời người học được nhận dạng từ giọng nói nên có thể sai chính tả hoặc thiếu dấu câu: KHÔNG tính đó là lỗi, chỉ xét ngữ pháp, dùng từ và độ tự nhiên.
- Chỉ nhận xét câu của người học (Learner), không nhận xét câu của AI.`

export function conversationFeedbackPrompt(opts: { topic: string; level: TalkLevel; turns: Array<{ role: string; text: string }> }) {
  return `Tình huống: ${opts.topic}
Trình độ người học: ${opts.level}
Hội thoại:
"""
${conversationTranscript(opts.turns)}
"""`
}

/** band IELTS: 0–9, bước 0.5 */
const band = () => z.number().min(0).max(9).describe('band IELTS 0-9, bước 0.5')

export const SpeakingFeedbackSchema = z.object({
  overall: band(),
  criteria: z
    .array(z.object({ name: z.string(), band: band(), comment: z.string().describe('nhận xét 1-2 câu bằng tiếng Việt') }))
    .describe('đúng 3 tiêu chí theo thứ tự: "Fluency & Coherence", "Lexical Resource", "Grammatical Range & Accuracy"'),
  covered: z
    .array(z.object({ point: z.string(), done: z.boolean() }))
    .describe('mỗi gợi ý của đề (chép nguyên văn) và người học đã nói tới chưa'),
  summary: z.string().describe('nhận xét tổng quan 2-3 câu bằng tiếng Việt: điểm tốt và việc cần làm để lên band'),
  corrections: z
    .array(
      z.object({
        said: z.string().describe('nguyên văn phần người học nói sai hoặc chưa tự nhiên'),
        better: z.string().describe('cách nói đúng, tự nhiên bằng tiếng Anh'),
        type: z.enum(CONVERSATION_MISTAKE_TYPES),
        explanation: z.string().describe('giải thích ngắn bằng tiếng Việt'),
      }),
    )
    .describe('tối đa 8 lỗi quan trọng nhất, theo thứ tự xuất hiện; rỗng nếu không có lỗi'),
  vocabulary: z
    .array(z.object({ en: z.string(), vi: z.string().describe('nghĩa tiếng Việt') }))
    .describe('4-8 từ / cụm từ hợp với đề này, vừa sức band mục tiêu (cao hơn trình độ hiện tại một chút)'),
  sample: z
    .string()
    .describe('bài nói mẫu đúng band mục tiêu bằng tiếng Anh, khoảng 200-250 từ, giữ ý tưởng của người học và trả lời đủ các gợi ý'),
})

export const SPEAKING_FEEDBACK_SYSTEM = `Bạn là giám khảo IELTS Speaking giàu kinh nghiệm, chấm bài Part 2 của người Việt.
- Chấm theo band descriptors chính thức, khắt khe như giám khảo thật; không nâng điểm để khích lệ.
- Bài nói được nhận dạng từ giọng nói nên có thể sai chính tả, thiếu dấu câu: KHÔNG tính đó là lỗi. Không chấm Pronunciation vì chỉ có văn bản.
- Fluency & Coherence xét độ dài (Part 2 nên nói 1.5-2 phút), tốc độ, mạch lạc, từ nối; nói dưới 1 phút thì khó quá band 5 ở tiêu chí này.
- Bài quá ngắn hoặc lạc đề thì nói rõ và chấm thấp tương ứng.
- Band mục tiêu của người học KHÔNG ảnh hưởng điểm chấm; chỉ dùng để chọn độ khó cho bài mẫu, từ vựng gợi ý và lời khuyên (việc cần làm để đạt mục tiêu).
- Nhận xét, giải thích bằng tiếng Việt; ví dụ và cách nói đúng bằng tiếng Anh.`

const SPEAKING_TARGET_DESC: Record<SpeakingTarget, string> = {
  '5': 'band 5–5.5: câu đơn và câu ghép đơn giản, từ vựng thông dụng, ít lỗi; bài mẫu dễ nói lại được',
  '6': 'band 6–6.5: có câu phức, từ nối đa dạng, vài collocation và cụm từ tự nhiên',
  '7': 'band 7+: cấu trúc linh hoạt, idiom và collocation ít phổ biến dùng đúng chỗ, mạch lạc tự nhiên',
}

export function speakingFeedbackPrompt(opts: { title: string; bullets: string[]; transcript: string; durationSec: number; target: string }) {
  const words = opts.transcript.split(/\s+/).filter(Boolean).length
  return `Band mục tiêu: ${SPEAKING_TARGET_DESC[opts.target as SpeakingTarget]}
Đề: ${opts.title}
${opts.bullets.length ? `Gợi ý:\n${opts.bullets.map((b) => `- ${b}`).join('\n')}` : '(không có gợi ý)'}
Thời lượng nói: ${opts.durationSec} giây, ${words} từ (${opts.durationSec ? Math.round((words / opts.durationSec) * 60) : 0} từ/phút)
Bài nói của người học:
"""
${opts.transcript}
"""`
}
