/**
 * Cấp CEFR của từ đơn theo danh sách mở:
 * - CEFR-J Wordlist 1.5 (A1–B2), Tono Laboratory, TUFS — dùng miễn phí, cần ghi nguồn
 * - Octanove Vocabulary Profile C1/C2 1.0 — CC BY-SA 4.0
 * (https://github.com/openlanguageprofiles/olp-en-cefrj)
 * Từ trong câu được đưa về dạng gốc (wink-lemmatizer: went → go, children → child) trước khi tra.
 */
import lemmatizer from 'wink-lemmatizer'

import type { VocabLevel } from '#/lib/levels'
import cefrj from './cefrj-vocabulary-profile-1.5.csv?raw'
import octanove from './octanove-vocabulary-profile-c1c2-1.0.csv?raw'

const RANK: Record<VocabLevel, number> = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 }

interface Entry {
  pos: string
  level: VocabLevel
}

let entries: Map<string, Entry[]> | null = null

/** headword → các từ loại kèm cấp; "a.m./A.M./am/AM" tách thành từng dạng, bỏ cụm nhiều từ */
function load() {
  if (entries) return entries
  entries = new Map()
  for (const csv of [cefrj, octanove]) {
    for (const line of csv.split('\n').slice(1)) {
      const [headword = '', pos = '', level = ''] = line.split(',')
      if (!(level in RANK)) continue
      for (const form of headword.split('/')) {
        const word = form.trim().toLowerCase()
        if (!word || word.includes(' ')) continue
        const list = entries.get(word) ?? []
        const same = list.find((e) => e.pos === pos.trim())
        if (!same) list.push({ pos: pos.trim(), level: level as VocabLevel })
        else if (RANK[level as VocabLevel] < RANK[same.level]) same.level = level as VocabLevel
        entries.set(word, list)
      }
    }
  }
  return entries
}

/** dạng biến đổi khớp được với từ loại nào: "negotiating" qua verb() → động từ */
const VERB_POS = ['verb', 'be-verb', 'do-verb', 'have-verb', 'modal auxiliary']
const POS_OF_FORM = { verb: VERB_POS, noun: ['noun'], adjective: ['adjective'] }

/**
 * dạng gốc có trong danh sách, cấp và từ loại (cấp thấp trước); null khi không có (tên riêng, từ hiếm…).
 * Từ đã đổi dạng thì chỉ giữ từ loại ứng với cách biến đổi đó.
 */
export function wordLevel(word: string): { lemma: string; level: VocabLevel; pos: string[] } | null {
  const map = load()
  const w = word.toLowerCase()
  const tries = [
    { lemma: w, form: null },
    { lemma: lemmatizer.verb(w), form: 'verb' as const },
    { lemma: lemmatizer.noun(w), form: 'noun' as const },
    { lemma: lemmatizer.adjective(w), form: 'adjective' as const },
  ]
  for (const { lemma, form } of tries) {
    const list = map.get(lemma)
    if (!list) continue
    const matching = form && lemma !== w ? list.filter((e) => POS_OF_FORM[form].includes(e.pos)) : []
    const chosen = [...(matching.length ? matching : list)].sort((a, b) => RANK[a.level] - RANK[b.level])
    return { lemma, level: chosen[0].level, pos: [...new Set(chosen.map((e) => e.pos))] }
  }
  return null
}

/**
 * từ trong một câu transcript: bỏ sở hữu cách ("Anne's" → Anne), bỏ dạng rút gọn ("don't", "I'm" — đều A1)
 * và số
 */
export function sentenceWords(text: string): string[] {
  return [...text.matchAll(/[A-Za-z]+(?:['’][A-Za-z]+)*/g)]
    .map((m) => m[0].replace(/['’]s$/i, ''))
    .filter((w) => !/['’]/.test(w))
}
