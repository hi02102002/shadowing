import type { Level } from './levels'

export const ROADMAP_ACTIVITY_TYPES = [
  'shadow',
  'dictation',
  'pronounce',
  'listening',
  'reading',
  'grammar',
  'talk',
  'reflex',
  'speaking',
  'chunks',
  'ipa',
  'flashcards',
] as const

export type RoadmapActivityType = (typeof ROADMAP_ACTIVITY_TYPES)[number]

export const VIDEO_ACTIVITY_TYPES = [
  'shadow',
  'dictation',
  'pronounce',
] as const
export type VideoActivityType = (typeof VIDEO_ACTIVITY_TYPES)[number]

export const isVideoActivity = (
  type: string,
): type is VideoActivityType =>
  type === 'shadow' || type === 'dictation' || type === 'pronounce'

export interface RoadmapActivityInfo {
  label: string
  shortLabel: string
  group: 'video' | 'listen-read' | 'speak' | 'foundation'
  detail: string
  defaultMinutes: number
}

export const ROADMAP_ACTIVITY_INFO: Record<
  RoadmapActivityType,
  RoadmapActivityInfo
> = {
  shadow: {
    label: 'Shadowing theo video',
    shortLabel: 'Shadowing',
    group: 'video',
    detail: 'Nghe và nhại lại đồng thời theo video YouTube / ELLLO để bắt nhịp, nối âm và ngữ điệu',
    defaultMinutes: 15,
  },
  dictation: {
    label: 'Nghe chép chính tả video',
    shortLabel: 'Chép chính tả',
    group: 'video',
    detail: 'Nghe từng câu trong video và gõ lại để phát hiện chỗ nuốt âm, dạng yếu',
    defaultMinutes: 15,
  },
  pronounce: {
    label: 'Luyện phát âm từng câu video',
    shortLabel: 'Phát âm video',
    group: 'video',
    detail: 'Ghi âm đọc lại từng câu trong video để AI chấm độ chính xác và 4 trụ cột',
    defaultMinutes: 10,
  },
  listening: {
    label: 'Luyện nghe hiểu (Listening)',
    shortLabel: 'Luyện nghe',
    group: 'listen-read',
    detail: 'Nghe hội thoại / bản tin từ Tactics, ELLLO, Breaking News, IELTS và trả lời câu hỏi',
    defaultMinutes: 15,
  },
  reading: {
    label: 'Đọc hiểu theo cấp độ (Reading)',
    shortLabel: 'Đọc hiểu',
    group: 'listen-read',
    detail: 'Đọc bài từ thư viện hoặc AI biên soạn theo chủ đề, làm câu hỏi đọc hiểu và học từ vựng',
    defaultMinutes: 15,
  },
  grammar: {
    label: 'Ngữ pháp (English Grammar in Use)',
    shortLabel: 'Ngữ pháp',
    group: 'foundation',
    detail: 'Học lý thuyết và làm bài tập trong 145 bài sách English Grammar in Use',
    defaultMinutes: 15,
  },
  talk: {
    label: 'Hội thoại nhập vai với AI',
    shortLabel: 'Hội thoại AI',
    group: 'speak',
    detail: 'Đóng vai giao tiếp thực tế với AI theo tình huống, nhận sửa lỗi câu nói cuối buổi',
    defaultMinutes: 10,
  },
  reflex: {
    label: 'Phản xạ nói nhanh',
    shortLabel: 'Phản xạ nói',
    group: 'speak',
    detail: 'Dịch nói Việt → Anh, hỏi đáp nhanh hoặc phản xạ tình huống dưới áp lực thời gian',
    defaultMinutes: 10,
  },
  speaking: {
    label: 'Nói theo đề (IELTS Part 2)',
    shortLabel: 'Nói theo đề',
    group: 'speak',
    detail: 'Chuẩn bị 1 phút và nói độc thoại 2 phút theo chủ đề, chấm band 4 tiêu chí',
    defaultMinutes: 15,
  },
  chunks: {
    label: 'Học cụm từ giao tiếp (Chunks)',
    shortLabel: 'Kho Chunks',
    group: 'foundation',
    detail: 'Học phrasal verb, collocation, khung câu thông dụng kèm nghe và đọc theo',
    defaultMinutes: 10,
  },
  ipa: {
    label: 'Luyện âm IPA & 4 trụ cột',
    shortLabel: 'Luyện IPA',
    group: 'foundation',
    detail: 'Sửa các nguyên âm / phụ âm hay nhầm và luyện Âm, Trọng âm, Ngữ điệu, Nhịp điệu',
    defaultMinutes: 10,
  },
  flashcards: {
    label: 'Ôn thẻ từ vựng (Flashcards)',
    shortLabel: 'Thẻ từ',
    group: 'foundation',
    detail: 'Ôn tập từ vựng và cụm từ đến hạn theo thuật toán lặp lại ngắt quãng FSRS',
    defaultMinutes: 10,
  },
}

export const ROADMAP_SKILL_GROUPS = [
  {
    id: 'video',
    label: 'Luyện qua Video (Thư viện / YouTube / ELLLO)',
    skills: ['shadow', 'dictation', 'pronounce'] as RoadmapActivityType[],
  },
  {
    id: 'listen-read',
    label: 'Nghe hiểu & Đọc hiểu',
    skills: ['listening', 'reading'] as RoadmapActivityType[],
  },
  {
    id: 'speak',
    label: 'Phản xạ & Giao tiếp với AI',
    skills: ['reflex', 'talk', 'speaking'] as RoadmapActivityType[],
  },
  {
    id: 'foundation',
    label: 'Ngữ pháp, Cụm từ, IPA & Thẻ từ',
    skills: ['grammar', 'chunks', 'ipa', 'flashcards'] as RoadmapActivityType[],
  },
] as const

export interface RoadmapGoalPreset {
  id: string
  label: string
  summary: string
  goalText: string
  defaultMonths: number
  defaultMinutes: number
  defaultSkills: RoadmapActivityType[]
}

export const ROADMAP_GOAL_PRESETS: RoadmapGoalPreset[] = [
  {
    id: 'fluency-6m',
    label: 'Thành thạo giao tiếp trong 6 tháng',
    summary: 'Nghe hiểu tự nhiên, phản xạ nhanh, nói trôi chảy trong đời sống & công việc',
    goalText:
      'Tôi muốn thành thạo giao tiếp tiếng Anh trong 6 tháng: nghe hiểu người bản xứ nói tự nhiên, phản xạ nói nhanh không cần dịch từng từ trong đầu, nắm vững ngữ pháp và cụm từ thông dụng.',
    defaultMonths: 6,
    defaultMinutes: 45,
    defaultSkills: [
      'shadow',
      'dictation',
      'listening',
      'reflex',
      'talk',
      'chunks',
      'grammar',
    ],
  },
  {
    id: 'all-round-3m',
    label: 'Toàn diện Nghe – Nói – Đọc – Ngữ pháp (3 tháng)',
    summary: 'Kết hợp đều video shadowing, bài nghe, bài đọc hiểu, ngữ pháp và phản xạ nói',
    goalText:
      'Tôi muốn nâng trình độ tiếng Anh toàn diện cả Nghe, Nói, Đọc hiểu, Từ vựng và Ngữ pháp trong 3 tháng có lộ trình rõ ràng từng ngày.',
    defaultMonths: 3,
    defaultMinutes: 45,
    defaultSkills: [
      'shadow',
      'listening',
      'reading',
      'grammar',
      'talk',
      'reflex',
      'chunks',
      'flashcards',
    ],
  },
  {
    id: 'work-interview',
    label: 'Giao tiếp công việc & Phỏng vấn (2 tháng)',
    summary: 'Tập trung hội thoại công sở, thuyết trình, phỏng vấn, đọc và nghe tài liệu',
    goalText:
      'Tôi muốn tự tin giao tiếp tiếng Anh trong công việc, họp với đồng nghiệp/khách hàng nước ngoài và trả lời phỏng vấn xin việc trong 2 tháng.',
    defaultMonths: 2,
    defaultMinutes: 30,
    defaultSkills: [
      'talk',
      'reflex',
      'shadow',
      'listening',
      'reading',
      'chunks',
      'grammar',
    ],
  },
  {
    id: 'ielts-prep',
    label: 'Luyện thi IELTS 4 kỹ năng (3 tháng)',
    summary: 'Luyện đề Listening, Reading, Speaking Part 1–2–3, từ vựng học thuật và ngữ pháp',
    goalText:
      'Tôi muốn ôn luyện IELTS toàn diện trong 3 tháng: nâng band Listening, Reading, Speaking Part 1–2–3, cải thiện phát âm, từ vựng và ngữ pháp.',
    defaultMonths: 3,
    defaultMinutes: 60,
    defaultSkills: [
      'listening',
      'reading',
      'speaking',
      'talk',
      'shadow',
      'grammar',
      'chunks',
    ],
  },
  {
    id: 'listening-pronunciation',
    label: 'Đột phá Nghe & Phát âm chuẩn (1 tháng)',
    summary: 'Sửa âm IPA, nối âm, trọng âm, chép chính tả và shadowing video hàng ngày',
    goalText:
      'Tôi muốn tập trung đột phá khả năng nghe hiểu tốc độ tự nhiên và sửa phát âm chuẩn (âm cuối, nối âm, trọng âm, ngữ điệu) trong 1 tháng.',
    defaultMonths: 1,
    defaultMinutes: 30,
    defaultSkills: [
      'ipa',
      'shadow',
      'dictation',
      'pronounce',
      'listening',
      'chunks',
    ],
  },
]

export const ROADMAP_MONTH_CHOICES = [1, 2, 3, 6] as const
export const ROADMAP_MINUTE_CHOICES = [15, 30, 45, 60, 90] as const

export function activityLabel(type: string): string {
  return (
    (ROADMAP_ACTIVITY_INFO as Partial<Record<string, RoadmapActivityInfo>>)[
      type
    ]?.shortLabel ?? type
  )
}

export function activityFullLabel(type: string): string {
  return (
    (ROADMAP_ACTIVITY_INFO as Partial<Record<string, RoadmapActivityInfo>>)[
      type
    ]?.label ?? type
  )
}

/** Tính cấp độ CEFR tiến dần từ currentLevel tới targetLevel ở tuần thứ `week` / `totalWeeks` */
export function interpolateLevel(
  current: Level,
  target: Level,
  week: number,
  totalWeeks: number,
): Level {
  const order: Level[] = ['A1', 'A2', 'B1', 'B2', 'C1']
  const startIdx = Math.max(0, order.indexOf(current))
  const endIdx = Math.max(startIdx, order.indexOf(target))
  if (totalWeeks <= 1 || startIdx === endIdx) return order[startIdx]
  const ratio = Math.min(1, Math.max(0, (week - 1) / (totalWeeks - 1)))
  const idx = Math.round(startIdx + (endIdx - startIdx) * ratio)
  return order[idx] ?? current
}
