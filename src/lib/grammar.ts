/**
 * Kiểu dữ liệu sách ngữ pháp (English Grammar in Use, tải lúc chạy từ essentialenglish.review).
 * Server parse HTML gốc thành cây `HtmlNode` đã lọc thẻ/thuộc tính → client dựng React, không dùng innerHTML.
 */

export type HtmlNode =
  | string
  | HtmlElement
  /** chỗ trống của bài tập thứ `blank` trong exercise */
  | { blank: number }

export interface HtmlElement {
  tag: string
  attrs?: Record<string, string>
  children: HtmlNode[]
  /** phần tử này là câu hỏi thứ `item` của exercise */
  item?: number
}

export type GrammarItem = (
  | {
      /** điền chỗ trống / viết lại câu; `example` = câu mẫu đã điền sẵn */
      kind: 'text'
      answers: string[]
      example: boolean
      /** viết nguyên câu → ô nhập dài */
      long: boolean
    }
  | { kind: 'rightWrong'; right: boolean; fixes: string[] }
  | { kind: 'choice'; options: string[]; correct: number[]; multi: boolean }
  /** ghép câu: chọn một dòng trong danh sách đáp án của exercise */
  | { kind: 'match'; options: string[]; answers: string[] }
) & {
  /** câu hỏi dạng chữ thuần (chỗ trống là ___), dùng cho AI và sổ lỗi */
  prompt: string
}

export interface GrammarExercise {
  /** "1.2" */
  key: string
  title: string
  body: HtmlNode[]
  items: GrammarItem[]
}

export interface GrammarSection {
  /** "A", "B"… */
  label: string
  body: HtmlNode[]
}

export interface GrammarUnit {
  /** "12" hoặc "appendix-3" */
  id: string
  /** thứ tự sắp xếp: unit 1–145, phụ lục 1001+ */
  order: number
  title: string
  group: string
  sections: GrammarSection[]
  exercises: GrammarExercise[]
}

export const GRAMMAR_GROUP_LABEL: Record<string, string> = {
  'Present and past': 'Hiện tại và quá khứ',
  'Present perfect and past': 'Hiện tại hoàn thành và quá khứ',
  Future: 'Tương lai',
  Modals: 'Động từ khuyết thiếu',
  'If and wish': 'Câu điều kiện và wish',
  Passive: 'Bị động',
  'Reported speech': 'Câu tường thuật',
  'Questions and auxiliary verbs': 'Câu hỏi và trợ động từ',
  '-ing and to ...': '-ing và to …',
  'Articles and nouns': 'Mạo từ và danh từ',
  'Pronouns and determiners': 'Đại từ và từ hạn định',
  'Relative clauses': 'Mệnh đề quan hệ',
  'Adjectives and adverbs': 'Tính từ và trạng từ',
  'Conjunctions and prepositions': 'Liên từ và giới từ',
  Prepositions: 'Giới từ',
  'Phrasal verbs': 'Cụm động từ',
  Appendix: 'Phụ lục',
}

export const groupLabel = (group: string) => GRAMMAR_GROUP_LABEL[group] ?? group

/** khoá lưu câu trả lời: "1.2#3" */
export const itemKey = (exerciseKey: string, idx: number) => `${exerciseKey}#${idx}`

/** câu trả lời đúng dạng chữ để hiện cho người học */
export function expectedAnswer(item: GrammarItem): string {
  switch (item.kind) {
    case 'text':
    case 'match':
      return item.answers.join(' / ')
    case 'choice':
      return item.correct.map((i) => item.options[i]).join(' + ')
    case 'rightWrong':
      return item.right ? 'Right' : `Wrong → ${item.fixes.join(' / ') || '(sửa lại)'}`
  }
}

/** đếm câu hỏi thật (bỏ câu mẫu) để tính tiến độ */
export const countItems = (ex: GrammarExercise[]) =>
  ex.reduce((n, e) => n + e.items.filter((i) => !(i.kind === 'text' && i.example)).length, 0)
