/** Tình huống và trình độ cho hội thoại nhập vai với AI (trang /talk), dùng chung client và server */

export const TALK_LEVELS = ['A2', 'B1', 'B2'] as const
export type TalkLevel = (typeof TALK_LEVELS)[number]

export const TALK_LEVEL_LABEL: Record<TalkLevel, string> = {
  A2: 'A2 · Cơ bản',
  B1: 'B1 · Trung cấp',
  B2: 'B2 · Khá',
}

export interface Scenario {
  id: string
  label: string
  /** mô tả ngắn cho người học */
  detail: string
  /** vai AI đóng và bối cảnh, bằng tiếng Anh, đưa thẳng vào prompt */
  setup: string
}

/** buổi thi thử IELTS Speaking với AI đóng vai giám khảo: nhận xét cuối buổi có band ước lượng */
export const IELTS_PART1 = 'ielts-part1'
export const IELTS_PART3 = 'ielts-part3'
export const isIeltsScenario = (id: string) => id === IELTS_PART1 || id === IELTS_PART3

const EXAMINER_RULES =
  'Ask exactly one question per turn, briefly acknowledge the answer ("I see.", "Thank you.") without praising, correcting or giving your own opinion, and never break the exam format.'

export const SCENARIOS: Scenario[] = [
  {
    id: 'cafe',
    label: 'Gọi đồ ở quán cà phê',
    detail: 'Gọi món, hỏi giá, chọn size',
    setup: 'You are a friendly barista at a busy coffee shop. The learner is a customer ordering drinks and snacks.',
  },
  {
    id: 'restaurant',
    label: 'Đi ăn nhà hàng',
    detail: 'Đặt bàn, gọi món, thanh toán',
    setup: 'You are a waiter at a casual restaurant. The learner is a customer having dinner: seating, ordering, asking about dishes, paying.',
  },
  {
    id: 'directions',
    label: 'Hỏi đường',
    detail: 'Hỏi cách đi đến một địa điểm',
    setup: 'You are a local person on the street in a big city. The learner is a tourist asking for directions to places nearby.',
  },
  {
    id: 'hotel',
    label: 'Nhận phòng khách sạn',
    detail: 'Check-in, hỏi tiện ích, báo sự cố',
    setup: 'You are a hotel receptionist. The learner is a guest checking in, asking about facilities, or reporting a problem with the room.',
  },
  {
    id: 'shopping',
    label: 'Mua quần áo',
    detail: 'Hỏi size, màu, đổi trả',
    setup: 'You are a shop assistant in a clothing store. The learner is a customer looking for clothes, asking about sizes, colours and returns.',
  },
  {
    id: 'doctor',
    label: 'Đi khám bệnh',
    detail: 'Kể triệu chứng, nghe lời khuyên',
    setup: 'You are a doctor at a clinic. The learner is a patient describing symptoms; ask follow-up questions and give simple advice.',
  },
  {
    id: 'interview',
    label: 'Phỏng vấn xin việc',
    detail: 'Giới thiệu bản thân, kinh nghiệm',
    setup: 'You are a hiring manager interviewing the learner for an office job. Ask typical interview questions one at a time.',
  },
  {
    id: IELTS_PART1,
    label: 'IELTS Speaking Part 1',
    detail: 'Giám khảo hỏi về bản thân, nơi ở, sở thích',
    setup: `You are an IELTS Speaking examiner conducting Part 1 (introduction and interview, about 4-5 minutes). Start by asking the learner's name, then ask 3-4 short questions about each of 2-3 familiar topics (home or hometown, work or studies, then everyday topics like hobbies, food, weather, technology). ${EXAMINER_RULES}`,
  },
  {
    id: 'smalltalk',
    label: 'Làm quen bạn mới',
    detail: 'Sở thích, công việc, cuối tuần',
    setup: 'You are a friendly new colleague meeting the learner at a coffee break. Make small talk about hobbies, work, weekends and plans.',
  },
]

export const CUSTOM_SCENARIO = 'custom'

/** Part 3 cần đề Part 2 vừa nói để hỏi sâu, nên không nằm trong danh sách chọn */
export function part3Setup(part2Title: string) {
  return `You are an IELTS Speaking examiner conducting Part 3 (discussion, about 4-5 minutes). The learner has just finished Part 2 on this topic: "${part2Title}". Ask more abstract, general questions linked to that topic (society, comparisons, past vs. future, causes and effects), and ask "why?" or follow-up questions when answers are short. ${EXAMINER_RULES}`
}

/** tối đa số lượt người học nói trong một buổi (giữ prompt và nhận xét cuối buổi gọn) */
export const MAX_USER_TURNS = 30

export function scenarioLabel(id: string, topic: string) {
  if (id === IELTS_PART3) return 'IELTS Speaking Part 3'
  return SCENARIOS.find((s) => s.id === id)?.label ?? topic
}
