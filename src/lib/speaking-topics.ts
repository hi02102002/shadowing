/** Đề nói kiểu IELTS Speaking Part 2 (cue card) cho trang /speaking, dùng chung client và server */

export interface SpeakingTopic {
  id: string
  /** nhóm chủ đề để lọc, tiếng Việt */
  group: string
  title: string
  bullets: string[]
}

const card = (id: string, group: string, title: string, ...bullets: string[]): SpeakingTopic => ({ id, group, title, bullets })

export const SPEAKING_TOPICS: SpeakingTopic[] = [
  card('place-live', 'Nơi chốn', 'Describe a place where you live or have lived that you really like.', 'where it is', 'what the place is like', 'what you usually do there', 'and explain why you like living there.'),
  card('city-visit', 'Nơi chốn', 'Describe a city you have visited that you would like to visit again.', 'where it is', 'when you went there', 'what you did there', 'and explain why you would like to go back.'),
  card('quiet-place', 'Nơi chốn', 'Describe a quiet place you like to spend time in.', 'where it is', 'how often you go there', 'what you do there', 'and explain why you like spending time there.'),
  card('person-admire', 'Con người', 'Describe a person you admire.', 'who this person is', 'how you know them', 'what this person has done', 'and explain why you admire them.'),
  card('friend', 'Con người', 'Describe a friend you have known for a long time.', 'who this friend is', 'how you met', 'what you do together', 'and explain why you have stayed friends for so long.'),
  card('teacher', 'Con người', 'Describe a teacher who has influenced you.', 'who the teacher was', 'what subject they taught', 'what they were like', 'and explain how they influenced you.'),
  card('object-useful', 'Đồ vật', 'Describe a useful object you use every day.', 'what it is', 'when you got it', 'how you use it', 'and explain why it is so useful to you.'),
  card('gift', 'Đồ vật', 'Describe a gift you gave to someone.', 'what the gift was', 'who you gave it to', 'why you chose it', 'and explain how the person felt about it.'),
  card('app', 'Đồ vật', 'Describe an app or website you often use.', 'what it is', 'how you found it', 'what you use it for', 'and explain why you like using it.'),
  card('event-happy', 'Sự kiện', 'Describe a time when you felt very happy.', 'when it was', 'where you were', 'what happened', 'and explain why you felt so happy.'),
  card('trip', 'Sự kiện', 'Describe a memorable trip you took.', 'where you went', 'who you went with', 'what you did during the trip', 'and explain why it was memorable.'),
  card('celebration', 'Sự kiện', 'Describe a celebration or festival you enjoyed.', 'what it was', 'when and where it took place', 'what people did', 'and explain why you enjoyed it.'),
  card('difficult-decision', 'Sự kiện', 'Describe a difficult decision you made.', 'what the decision was', 'when you made it', 'how you made it', 'and explain how you felt about the result.'),
  card('skill-learn', 'Học tập & công việc', 'Describe a skill you would like to learn.', 'what the skill is', 'how you would learn it', 'how long it would take', 'and explain why you want to learn it.'),
  card('job-dream', 'Học tập & công việc', 'Describe a job you would like to do in the future.', 'what the job is', 'what skills it needs', 'how you could get this job', 'and explain why you would like to do it.'),
  card('book', 'Sở thích', 'Describe a book you have read recently.', 'what the book is', 'what it is about', 'why you decided to read it', 'and explain what you learned from it.'),
  card('film', 'Sở thích', 'Describe a film or TV series you enjoyed.', 'what it was', 'when you watched it', 'what it was about', 'and explain why you enjoyed it.'),
  card('hobby', 'Sở thích', 'Describe a hobby you enjoy doing in your free time.', 'what the hobby is', 'when you started it', 'how often you do it', 'and explain why you enjoy it.'),
  card('sport', 'Sở thích', 'Describe a sport or exercise you like doing.', 'what it is', 'where and when you do it', 'who you do it with', 'and explain why you like it.'),
  card('food', 'Đời sống', 'Describe a meal or dish you enjoy eating.', 'what it is', 'how it is made', 'when you usually eat it', 'and explain why you enjoy it.'),
  card('habit', 'Đời sống', 'Describe a healthy habit you have.', 'what the habit is', 'when you started it', 'how it affects your life', 'and explain why you think it is healthy.'),
  card('change', 'Đời sống', 'Describe a change that would improve your local area.', 'what the change is', 'how it could be made', 'who would benefit from it', 'and explain why it would improve the area.'),
]

export const CUSTOM_TOPIC = 'custom'

/** band mục tiêu: không đổi cách chấm, chỉ đổi bài mẫu, từ vựng gợi ý và lời khuyên cho vừa sức */
export const SPEAKING_TARGETS = ['5', '6', '7'] as const
export type SpeakingTarget = (typeof SPEAKING_TARGETS)[number]

export const SPEAKING_TARGET_LABEL: Record<SpeakingTarget, string> = {
  '5': 'Band 5–5.5',
  '6': 'Band 6–6.5',
  '7': 'Band 7+',
}

/** thời gian chuẩn bị và nói tối đa như phòng thi */
export const PREP_SECONDS = 60
export const MAX_SPEAK_SECONDS = 120

/**
 * Đọc đề người học dán vào: dòng đầu là đề, các dòng sau là gợi ý (bỏ "-", "•", "*" đầu dòng),
 * bỏ dòng "You should say:" và dòng trống.
 */
export function parseCueCard(text: string): { title: string; bullets: string[] } | null {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/^\s*[-•*–]\s*/, '').trim())
    .filter((l) => l && !/^you should say:?$/i.test(l))
  if (!lines.length) return null
  return { title: lines[0], bullets: lines.slice(1) }
}
