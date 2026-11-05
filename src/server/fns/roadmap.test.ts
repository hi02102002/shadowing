import { describe, expect, it } from 'vitest'

import { interpolateLevel, isVideoActivity } from '#/lib/roadmap'
import {
  expandPhasesToWeeks,
  grammarUnitsForLevel,
  mapLimit,
  matchGrammarUnit,
  normalizePhases,
  resolveGrammarTask,
  normalizeRoadmapWeeks,
  pickBestVideo,
  scoreKeywordMatch,
  tokenizeQuery,
} from './roadmap'

describe('roadmap helpers', () => {
  it('tính cấp độ CEFR tiến dần theo tuần từ trình độ hiện tại tới mục tiêu', () => {
    expect(interpolateLevel('A2', 'B2', 1, 24)).toBe('A2')
    expect(interpolateLevel('A2', 'B2', 12, 24)).toBe('B1')
    expect(interpolateLevel('A2', 'B2', 24, 24)).toBe('B2')
    expect(interpolateLevel('B1', 'B1', 5, 12)).toBe('B1')
  })

  it('phân biệt đúng nhóm nhiệm vụ video và nhiệm vụ kỹ năng khác', () => {
    expect(isVideoActivity('shadow')).toBe(true)
    expect(isVideoActivity('dictation')).toBe(true)
    expect(isVideoActivity('pronounce')).toBe(true)
    expect(isVideoActivity('grammar')).toBe(false)
    expect(isVideoActivity('reading')).toBe(false)
    expect(isVideoActivity('listening')).toBe(false)
  })

  it('tách từ khoá truy vấn, loại bỏ từ có dấu tiếng Việt bị cắt vụn và từ dừng CEFR', () => {
    expect(
      tokenizeQuery('order food restaurant in English A2 conversation'),
    ).toEqual(['order', 'food', 'restaurant', 'in'])

    // Từ tiếng Việt có dấu không bị cắt thành mảnh ASCII ("ng", "thi") gây khớp nhầm "doing" / "something"
    expect(
      tokenizeQuery('present simple be Động từ To Be trong giới thiệu bản thân'),
    ).toEqual(['present', 'simple', 'be'])

    const high = scoreKeywordMatch(
      'Ordering Food at a Busy Restaurant',
      'order food restaurant',
    )
    const low = scoreKeywordMatch(
      'Talking About Weather and Seasons',
      'order food restaurant',
    )
    expect(high).toBeGreaterThan(low)
    expect(low).toBe(0)
  })

  it('chọn video khớp chủ đề nhất và bỏ qua các video đã dùng ở ngày trước', () => {
    const candidates = [
      {
        source: 'elllo' as const,
        url: 'https://elllo.org/video/A2/hotel.htm',
        title: 'Checking in at a Hotel Reception',
      },
      {
        source: 'youtube' as const,
        url: 'https://www.youtube.com/watch?v=abc12345678',
        youtubeId: 'abc12345678',
        title: 'Job Interview Questions and Answers',
      },
      {
        source: 'youtube' as const,
        url: 'https://www.youtube.com/watch?v=def12345678',
        youtubeId: 'def12345678',
        title: 'Software Engineer Job Interview Practice',
      },
    ]

    const usedUrls = new Set<string>()
    const usedIds = new Set<string>()

    const first = pickBestVideo(
      candidates,
      'job interview questions',
      usedUrls,
      usedIds,
    )
    expect(first?.youtubeId).toBe('abc12345678')

    // Đánh dấu bài đầu đã dùng -> lần chọn tiếp theo phải lấy bài phỏng vấn thứ hai
    usedIds.add('abc12345678')
    const second = pickBestVideo(
      candidates,
      'job interview',
      usedUrls,
      usedIds,
    )
    expect(second?.youtubeId).toBe('def12345678')
  })

  it('ghép đúng Unit trong sách English Grammar in Use và không trùng bài đã học', () => {
    const units = [
      { id: '1', title: 'Present continuous (I am doing)', group: 'Present and past' },
      { id: '2', title: 'Present simple (I do)', group: 'Present and past' },
      { id: '7', title: 'Present perfect 1 (I have done)', group: 'Present perfect and past' },
      { id: '10', title: 'Present perfect continuous and simple (I have been doing and I have done)', group: 'Present perfect and past' },
      { id: '13', title: 'Present perfect and past 1', group: 'Present perfect and past' },
      { id: '42', title: 'Passive 1 (is done / was done)', group: 'Passive' },
      { id: '49', title: 'Questions 1', group: 'Questions and auxiliary verbs' },
      { id: '61', title: "Be / get used to something (I'm used to ...)", group: '-ing and to ...' },
      { id: '113', title: 'Although / though / even though; in spite of / despite', group: 'Conjunctions and prepositions' },
      { id: '123', title: 'In/at/on (position) 1', group: 'Prepositions' },
    ]
    const used = new Set<string>()

    // 1. "present simple be" kèm tiếng Việt phải chọn Unit 2 thay vì Unit 10 ("been doing")
    const mPresentSimple = matchGrammarUnit(
      units,
      'present simple be Động từ To Be trong giới thiệu bản thân',
      'A2',
      used,
    )
    expect(mPresentSimple.unitId).toBe('2')

    // 2. "questions with be" phải chọn Unit 49 (Questions 1) thay vì Unit 61 (Be / get used to something)
    const mQuestions = matchGrammarUnit(
      units,
      'questions with be Câu hỏi thông tin với To Be',
      'A2',
      used,
    )
    expect(mQuestions.unitId).toBe('49')

    // 3. "prepositions at on in Prepositions of place" phải chọn Unit 123 thay vì Unit 113
    const mPrepositions = matchGrammarUnit(
      units,
      'prepositions at on in Prepositions of place',
      'A2',
      used,
    )
    expect(mPrepositions.unitId).toBe('123')

    // 4. Lần lượt chọn present perfect (Unit 7 -> Unit 13)
    const m1 = matchGrammarUnit(units, 'present perfect', 'B1', used)
    expect(m1.unitId).toBe('7')
    expect(used.has('7')).toBe(true)

    const m2 = matchGrammarUnit(units, 'present perfect', 'B1', used)
    expect(m2.unitId).toBe('13')

    // 5. Tôn trọng preferredUnitId do AI chỉ định
    const mPreferred = matchGrammarUnit(units, 'passive voice', 'B1', used, 'Unit 42')
    expect(mPreferred.unitId).toBe('42')
  })

  it('chuẩn hoá danh sách tuần đủ số tuần và chỉ giữ kỹ năng người dùng đã chọn', () => {
    const weeks = normalizeRoadmapWeeks({
      weeks: [
        {
          week: 1,
          phaseIndex: 1,
          title: 'Tuần 1: Làm quen',
          theme: 'Chào hỏi',
          level: 'A2',
          focusSkills: ['shadow', 'grammar', 'reading'],
          searchKeywords: ['greetings'],
        },
      ],
      phases: [
        {
          index: 1,
          title: 'Giai đoạn 1',
          weeks: 4,
          targetLevel: 'B1',
          focus: 'Phản xạ cơ bản',
          milestones: ['Nghe hiểu câu ngắn'],
        },
      ],
      totalWeeks: 4,
      currentLevel: 'A2',
      targetLevel: 'B1',
      focusSkills: ['shadow', 'grammar'],
    })

    expect(weeks).toHaveLength(4)
    expect(weeks[0].focusSkills).toEqual(['shadow', 'grammar'])
    expect(weeks[3].week).toBe(4)
    expect(weeks[3].level).toBe('B1')
  })

  it('ép tổng số tuần các phase đúng bằng totalWeeks và trải chủ đề lên từng tuần', () => {
    const phases = normalizePhases(
      [
        { weeks: 10, index: 1 },
        { weeks: 10, index: 2 },
        { weeks: 10, index: 3 },
      ],
      12,
    )
    expect(phases.reduce((n, p) => n + p.weeks, 0)).toBe(12)
    expect(phases.map((p) => p.index)).toEqual([1, 2, 3])

    const weeks = expandPhasesToWeeks({
      phases: [
        {
          index: 1,
          title: 'GĐ1',
          weeks: 4,
          targetLevel: 'B1',
          focus: 'Nền tảng',
          milestones: [],
          themes: [
            { title: 'A', theme: 'a', searchKeywords: ['a'] },
            { title: 'B', theme: 'b', searchKeywords: ['b'] },
          ],
        },
      ],
      currentLevel: 'A2',
      focusSkills: ['shadow'],
    })
    expect(weeks.map((w) => w.week)).toEqual([1, 2, 3, 4])
    expect(weeks.map((w) => w.title)).toEqual(['A', 'A', 'B', 'B'])
    expect(weeks[3].level).toBe('B1')
  })

  it('mapLimit giữ thứ tự kết quả và không vượt quá giới hạn song song', async () => {
    let running = 0
    let peak = 0
    const out = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      running++
      peak = Math.max(peak, running)
      await new Promise((r) => setTimeout(r, 5))
      running--
      return n * 2
    })
    expect(out).toEqual([2, 4, 6, 8, 10, 12])
    expect(peak).toBeLessThanOrEqual(2)
  })

  it('ngữ pháp: tin Unit AI chọn dù từ khoá lệch, ghi đè title khi phải đổi Unit', () => {
    const units = [
      { id: '2', title: 'Present simple (I do)', group: 'Present and past' },
      { id: '42', title: 'Passive 1 (is done / was done)', group: 'Passive' },
      { id: '49', title: 'Questions 1', group: 'Questions and auxiliary verbs' },
    ]
    const used = new Set<string>()

    // AI chọn Unit 42 nhưng searchQuery lệch hoàn toàn: vẫn giữ Unit 42, không ghi đè nội dung AI viết
    const a = resolveGrammarTask({
      units,
      level: 'B1',
      query: 'daily routine',
      preferredUnitId: '42',
      usedUnits: used,
    })
    expect(a.resource.unitId).toBe('42')
    expect(a.override).toBeUndefined()

    // Unit 42 đã dùng: phải đổi sang Unit khác và ghi đè title/description cho khớp
    const b = resolveGrammarTask({
      units,
      level: 'B1',
      query: 'questions',
      preferredUnitId: '42',
      usedUnits: used,
    })
    expect(b.resource.unitId).toBe('49')
    expect(b.override?.title).toContain('Unit 49')
  })

  it('ngữ pháp: danh sách gửi cho AI lọc theo trình độ và bỏ Unit đã học', () => {
    const units = Array.from({ length: 145 }, (_, i) => ({
      id: String(i + 1),
      title: `Unit ${i + 1}`,
      group: 'g',
    }))
    const list = grammarUnitsForLevel(units, 'A1', new Set(['1']))
    expect(list.every((u) => Number(u.id) <= 35 && u.id !== '1')).toBe(true)
    expect(list.length).toBe(34)
  })
})
