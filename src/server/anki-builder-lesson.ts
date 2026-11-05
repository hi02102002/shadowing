/** Đọc bài học từ data.json của essentialenglish.review (hoặc URL bài học / data.json bất kỳ) và bóc tách từ, cụm từ, ghi chú */
import { PRESET_BOOKS } from '#/lib/anki-builder.ts'
import type {
  ExtractedNote,
  ExtractedVocabulary,
  LessonAnalysis,
} from '#/lib/anki-builder.ts'

const normalizeText = (value: string) => value.replace(/\s+/g, ' ').trim()

export function cleanHtmlText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/&rsquo;|&lsquo;|&#39;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&ndash;|&mdash;/g, '-')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanVocabularyItem(value: string) {
  return (
    normalizeText(value)
      // The dataset sometimes appends a bare part-of-speech marker, e.g. "smile   v", "chat n,".
      .replace(/\s+(?:n|v|adj|adv)[.,]?$/i, '')
      .trim()
  )
}

type EssentialEnglishWord = {
  en?: string
  pron?: string
  desc?: string
  exam?: string
  image?: string
  sound?: string
}

type EssentialEnglishReading = {
  type?: string
  block?: string
  en?: string
  story?: string
  image?: string
  sound?: string
}

type EssentialEnglishUnit = {
  en?: string
  image?: string
  desc?: string
  reading?: EssentialEnglishReading[]
  wordlist?: EssentialEnglishWord[]
}

type EssentialEnglishDataset = {
  flashcard?: EssentialEnglishUnit[]
}

export type LessonTargetOptions = {
  url?: string
  bookSlug?: string
  unitNumber?: number
}

type ResolvedTarget = {
  unitNumber: number
  datasetUrl: string
  bookSlug?: string
  sourceUrl: string
}

export function parseLessonTarget(
  options: LessonTargetOptions | string,
): ResolvedTarget {
  const opts: LessonTargetOptions =
    typeof options === 'string' ? { url: options } : options

  // Case 1: bookSlug & unitNumber specified directly
  if (opts.bookSlug && opts.unitNumber) {
    return {
      unitNumber: opts.unitNumber,
      datasetUrl: `https://www.essentialenglish.review/apps-data/${opts.bookSlug}/data/data.json`,
      bookSlug: opts.bookSlug,
      sourceUrl:
        opts.url ||
        `https://www.essentialenglish.review/apps/${opts.bookSlug}/unit-${opts.unitNumber}`,
    }
  }

  const rawUrl = opts.url?.trim()
  if (!rawUrl) {
    throw new Error(
      'Please provide either a lesson URL or select a book and unit number.',
    )
  }

  try {
    const parsed = new URL(rawUrl)

    // Direct JSON URL: /apps-data/<slug>/data/data.json
    const appsDataMatch = parsed.pathname.match(
      /\/apps-data\/([^/]+)\/data\/data\.json/i,
    )
    if (appsDataMatch) {
      const bookSlug = appsDataMatch[1]
      const unitNum =
        opts.unitNumber ||
        Number(parsed.searchParams.get('unit')) ||
        (parsed.hash
          ? Number(parsed.hash.replace(/[^0-9]/g, ''))
          : undefined) ||
        1
      return {
        unitNumber: unitNum,
        datasetUrl: `${parsed.origin}${parsed.pathname}`,
        bookSlug,
        sourceUrl: rawUrl,
      }
    }

    // Normal lesson URL: /apps/<book>/unit-9-the-body-and-movement
    const lessonMatch = parsed.pathname.match(
      /^\/apps\/([^/]+)\/unit-(\d+)(?:-|\/|$)/i,
    )
    if (lessonMatch) {
      const [, bookSlug, unit] = lessonMatch
      return {
        unitNumber: opts.unitNumber || Number(unit),
        datasetUrl: `${parsed.origin}/apps-data/${bookSlug}/data/data.json`,
        bookSlug,
        sourceUrl: rawUrl,
      }
    }

    // Book URL: /book/<book>/unit-9-the-body-and-movement
    const bookMatch = parsed.pathname.match(
      /^\/book\/([^/]+)\/unit-(\d+)(?:-|\/|$)/i,
    )
    if (bookMatch) {
      const [, bookSlug, unit] = bookMatch
      return {
        unitNumber: opts.unitNumber || Number(unit),
        datasetUrl: `https://www.essentialenglish.review/apps-data/${bookSlug}/data/data.json`,
        bookSlug,
        sourceUrl: rawUrl,
      }
    }

    // Any URL with unit-(\d+) in path
    const genericUnitMatch = parsed.pathname.match(/unit-(\d+)/i)
    if (genericUnitMatch) {
      const unit = Number(genericUnitMatch[1])
      const bookSlug =
        opts.bookSlug ||
        'english-vocabulary-in-use-pre-intermediate-and-intermediate'
      return {
        unitNumber: opts.unitNumber || unit,
        datasetUrl: parsed.pathname.endsWith('.json')
          ? rawUrl
          : `https://www.essentialenglish.review/apps-data/${bookSlug}/data/data.json`,
        bookSlug,
        sourceUrl: rawUrl,
      }
    }

    // Generic JSON URL
    if (parsed.pathname.endsWith('.json')) {
      return {
        unitNumber: opts.unitNumber || 1,
        datasetUrl: rawUrl,
        bookSlug: opts.bookSlug,
        sourceUrl: rawUrl,
      }
    }
  } catch {
    // If rawUrl is not a valid full URL, test if it's a relative path or slug
  }

  // Fallback if unitNumber is available
  if (opts.unitNumber) {
    const bookSlug =
      opts.bookSlug ||
      'english-vocabulary-in-use-pre-intermediate-and-intermediate'
    return {
      unitNumber: opts.unitNumber,
      datasetUrl: `https://www.essentialenglish.review/apps-data/${bookSlug}/data/data.json`,
      bookSlug,
      sourceUrl: rawUrl,
    }
  }

  throw new Error(
    'Could not determine the unit number or book from the provided input.',
  )
}

function findUnit(dataset: EssentialEnglishDataset, unitNumber: number) {
  const units = Array.isArray(dataset.flashcard) ? dataset.flashcard : []
  const prefix = new RegExp(`^Unit\\s+${unitNumber}\\s*:`, 'i')
  const found = units.find((unit) => prefix.test(normalizeText(unit.en ?? '')))
  if (found) return found

  const prefixLoose = new RegExp(`^Unit\\s+${unitNumber}(?:\\s|$)`, 'i')
  const foundLoose = units.find((unit) =>
    prefixLoose.test(normalizeText(unit.en ?? '')),
  )
  if (foundLoose) return foundLoose

  if (unitNumber >= 1 && unitNumber <= units.length) {
    return units[unitNumber - 1]
  }

  return undefined
}

function resolveImageUrl(
  img: string | undefined,
  datasetUrl: string,
): string | undefined {
  if (!img) return undefined
  const trimmed = img.trim()
  if (!trimmed) return undefined
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  // Dead phantom filenames in essentialenglish dataset (e.g. 36178.jpg, 35900.jpg)
  // All purely numeric image filenames in wordlist return 404 Not Found on the server.
  if (/^\d+\.(?:jpe?g|png|webp|gif|svg)$/i.test(trimmed)) {
    return undefined
  }

  // Filter out speaker/audio icons or UI buttons
  if (/\b(?:icon|speaker|button|arrow|close|play)\b/i.test(trimmed)) {
    return undefined
  }

  try {
    const parsed = new URL(datasetUrl)
    const basePath = parsed.pathname.replace(/\/data\/data\.json$/i, '')
    return `${parsed.origin}${basePath}/${trimmed.replace(/^\/+/, '')}`
  } catch {
    return undefined
  }
}

export function isGrammarDataset(
  unit: EssentialEnglishUnit,
  bookSlugOrUrl?: string,
): boolean {
  if (bookSlugOrUrl && /grammar/i.test(bookSlugOrUrl)) return true
  if (
    (!unit.wordlist || unit.wordlist.length === 0) &&
    (unit.reading?.length ?? 0) > 1
  ) {
    return true
  }
  return false
}

function extractGrammarPhrasesAndWords(
  unit: EssentialEnglishUnit,
  datasetUrl: string,
): {
  words: string[]
  phrases: string[]
  vocabularyList: ExtractedVocabulary[]
} {
  const wordsList: ExtractedVocabulary[] = []
  const phrasesList: ExtractedVocabulary[] = []
  const seen = new Set<string>()

  const stories = (unit.reading ?? []).filter((r) => r.type === 'story')

  // Find section images (e.g. Unit1-a.jpg)
  const sectionImages: string[] = []
  for (const s of stories) {
    const imgMatch = s.story?.match(/<img[^>]*src=["']([^"']+)["']/i)
    if (imgMatch) {
      const resolved = resolveImageUrl(imgMatch[1], datasetUrl)
      if (resolved && !sectionImages.includes(resolved)) {
        sectionImages.push(resolved)
      }
    }
  }

  // 1. Extract verbs & grammar forms from <ul class="ul-free-option-none">
  for (const s of stories) {
    const storyHtml = s.story ?? ''
    const ulMatches =
      storyHtml.match(
        /<ul[^>]*class=["'][^"']*ul-free-option-none[^"']*["'][^>]*>(.*?)<\/ul>/gis,
      ) || []
    for (const ul of ulMatches) {
      const liMatches = ul.match(/<li>(.*?)<\/li>/gi) || []
      for (const li of liMatches) {
        const text = cleanVocabularyItem(cleanHtmlText(li))
        if (text && text.length >= 2 && !seen.has(text.toLowerCase())) {
          seen.add(text.toLowerCase())
          wordsList.push({
            word: text,
            kind: text.includes(' ') ? 'phrase' : 'word',
            hint: 'Động từ/Cấu trúc trọng tâm bài học',
          })
        }
      }
    }
  }

  // 2. Extract bold structures, collocations, and contrastive examples from stories
  let sectionIndex = 0
  for (const s of stories) {
    const storyHtml = s.story ?? ''
    const sectionImg =
      (s.story?.match(/<img[^>]*src=["']([^"']+)["']/i)
        ? resolveImageUrl(
            s.story.match(/<img[^>]*src=["']([^"']+)["']/i)![1],
            datasetUrl,
          )
        : undefined) || sectionImages[sectionIndex]
    sectionIndex++

    // Check list items <li>...</li>
    const liMatches = storyHtml.match(/<li>(.*?)<\/li>/gis) || []
    for (const li of liMatches) {
      const cleanLi = cleanHtmlText(li)
      const notMatch = cleanLi.match(/\((?:not\s*)([^)]+)\)/i)
      const hint = notMatch ? `(not: ${cleanHtmlText(notMatch[1])})` : undefined

      const strongs = li.match(/<strong>(.*?)<\/strong>/gi) || []
      for (const st of strongs) {
        let raw = cleanHtmlText(st)
          .replace(/^[.,;:—–-]+\s*|\s*[.,;:—–-]+$/g, '')
          .trim()
        if (!raw || raw.length < 2) continue

        // Contraction cleanup: "'s having" -> "He's having"
        if (/^['’]/.test(raw)) {
          const beforePart = li.split(st)[0]
          const lastWord = cleanHtmlText(beforePart)
            .trim()
            .split(/\s+/)
            .pop()
            ?.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '')
          if (lastWord) {
            raw = `${lastWord}${raw}`
          }
        }

        // Skip bare auxiliary verbs if they were isolated
        if (/^(?:are|is|am|were|was|do|does|did)$/i.test(raw)) {
          continue
        }

        const lower = raw.toLowerCase()
        if (seen.has(lower)) continue
        seen.add(lower)

        phrasesList.push({
          word: raw,
          hint,
          exam: cleanLi,
          image: sectionImg,
          kind: raw.includes(' ') ? 'phrase' : 'word',
        })
      }
    }

    // Check key bold concepts in paragraphs: <p><strong>...</strong>...</p>
    const pMatches =
      storyHtml.match(
        /<p>\s*<strong>(.*?)<\/strong>(.*?)(?:<\/p>|<br\s*\/?>)/gis,
      ) || []
    for (const p of pMatches) {
      const stMatch = p.match(/<strong>(.*?)<\/strong>/i)
      if (stMatch) {
        const raw = cleanHtmlText(stMatch[1]).trim()
        if (
          raw &&
          raw.length >= 3 &&
          !seen.has(raw.toLowerCase()) &&
          !raw.includes('.jpg')
        ) {
          seen.add(raw.toLowerCase())
          const afterText = cleanHtmlText(
            p.replace(/<strong>.*?<\/strong>/i, ''),
          ).trim()
          phrasesList.push({
            word: raw,
            hint: afterText ? afterText.slice(0, 100) : undefined,
            image: sectionImg,
            kind: 'phrase',
          })
        }
      }
    }
  }

  // Deduplicate and promote more complete phrases
  const dedupedPhrases: ExtractedVocabulary[] = []
  const sortedPhrases = [...phrasesList].sort(
    (a, b) => b.word.length - a.word.length,
  )

  for (const item of sortedPhrases) {
    const textCore = item.word
      .toLowerCase()
      .replace(/^(?:to\s+(?:be\s+)?|a\s+|an\s+|the\s+|as\s+)/, '')
      .trim()
    const existing = dedupedPhrases.find((r) => {
      const rCore = r.word
        .toLowerCase()
        .replace(/^(?:to\s+(?:be\s+)?|a\s+|an\s+|the\s+|as\s+)/, '')
        .trim()
      return rCore === textCore || rCore.includes(textCore)
    })

    if (existing) {
      if (!existing.hint && item.hint) existing.hint = item.hint
      if (!existing.image && item.image) existing.image = item.image
      if (!existing.exam && item.exam) existing.exam = item.exam
    } else {
      dedupedPhrases.push(item)
    }
  }

  dedupedPhrases.sort((a, b) => a.word.localeCompare(b.word))
  wordsList.sort((a, b) => a.word.localeCompare(b.word))

  return {
    words: wordsList.map((w) => w.word),
    phrases: dedupedPhrases.map((p) => p.word),
    vocabularyList: [...wordsList, ...dedupedPhrases],
  }
}

export function extractPhrasesAndWords(
  unit: EssentialEnglishUnit,
  datasetUrl: string,
  bookSlug?: string,
): {
  words: string[]
  phrases: string[]
  vocabularyList: ExtractedVocabulary[]
} {
  if (isGrammarDataset(unit, bookSlug || datasetUrl)) {
    return extractGrammarPhrasesAndWords(unit, datasetUrl)
  }

  const wordsList: ExtractedVocabulary[] = []
  const phrasesList: ExtractedVocabulary[] = []
  const seen = new Set<string>()

  // 1. Process unit.wordlist
  for (const item of unit.wordlist ?? []) {
    const rawWord = cleanVocabularyItem(cleanHtmlText(item.en ?? ''))
    if (!rawWord || rawWord.length < 2) continue
    const lower = rawWord.toLowerCase()
    if (seen.has(lower)) continue
    seen.add(lower)

    const fullImageUrl = resolveImageUrl(item.image, datasetUrl)
    const isPhrase =
      rawWord.includes(' ') ||
      rawWord.includes('-') ||
      rawWord.startsWith('to ')

    const vocabItem: ExtractedVocabulary = {
      word: rawWord,
      hint: item.desc ? cleanHtmlText(item.desc) : undefined,
      pron: item.pron,
      desc: item.desc,
      exam: item.exam,
      image: fullImageUrl,
      kind: isPhrase ? 'phrase' : 'word',
    }

    if (isPhrase) {
      phrasesList.push(vocabItem)
    } else {
      wordsList.push(vocabItem)
    }
  }

  // 2. Process unit.reading[0].story
  const story = unit.reading?.[0]?.story ?? ''
  if (story) {
    // A. Match list items with images and phrases, e.g. <li><img src="..."><br /><strong>shake hands with someone</strong></li>
    const liRegex =
      /<li>(?:\s*<img[^>]*src=["']([^"']+)["'][^>]*>)?(?:\s*<br\s*\/?>)?\s*(?:<strong>)?([^<]+)(?:<\/strong>)?(?:\s*\[([^\]]+)\])?\s*<\/li>/gi
    let liMatch: RegExpExecArray | null
    while ((liMatch = liRegex.exec(story)) !== null) {
      const imgSrc = liMatch[1]
      const text = cleanHtmlText(liMatch[2])
        .replace(/^[.,;:—–-]+\s*|\s*[.,;:—–-]+$/g, '')
        .trim()
      const hint = liMatch[3] ? cleanHtmlText(liMatch[3]) : undefined
      if (text && text.length > 2 && !/^(?:a|an|the)$/i.test(text)) {
        const fullImg = resolveImageUrl(imgSrc, datasetUrl)
        const lower = text.toLowerCase()
        const existing = phrasesList.find((p) => p.word.toLowerCase() === lower)
        if (existing) {
          if (!existing.image && fullImg) existing.image = fullImg
          if (!existing.hint && hint) existing.hint = hint
        } else {
          phrasesList.push({
            word: text,
            hint,
            image: fullImg,
            kind: text.includes(' ') ? 'phrase' : 'word',
          })
          seen.add(lower)
        }
      }
    }

    // B. Match <strong> tags followed by optional [hint] or (hint)
    const strongRegex =
      /<strong>([^<]+)<\/strong>(?:[\s.,;:—–-]*[[(]([^\])<]+)[\])])?/gi
    let sMatch: RegExpExecArray | null
    while ((sMatch = strongRegex.exec(story)) !== null) {
      const text = cleanHtmlText(sMatch[1])
        .replace(/^[.,;:—–-]+\s*|\s*[.,;:—–-]+$/g, '')
        .trim()
      const hint = sMatch[2] ? cleanHtmlText(sMatch[2]) : undefined
      if (
        !text ||
        text.length < 2 ||
        /^(?:a|an|the|in|out|on|at|to|of|for|and|or|not|n|v|adj|adv|noun|verb|adjective|adverb)$/i.test(
          text,
        ) ||
        text.includes('.jpg') ||
        text.includes('.png')
      ) {
        continue
      }

      const lower = text.toLowerCase()
      const existingPhrase = phrasesList.find(
        (p) => p.word.toLowerCase() === lower,
      )
      if (existingPhrase) {
        if (!existingPhrase.hint && hint) existingPhrase.hint = hint
        continue
      }

      const existingWord = wordsList.find((w) => w.word.toLowerCase() === lower)
      if (existingWord) {
        if (!existingWord.hint && hint) existingWord.hint = hint
        continue
      }

      seen.add(lower)
      if (text.includes(' ') || text.includes('-') || text.startsWith('to ')) {
        phrasesList.push({
          word: text,
          hint,
          kind: 'phrase',
        })
      } else {
        wordsList.push({
          word: text,
          hint,
          kind: 'word',
        })
      }
    }
  }

  // Deduplicate and promote more complete phrases (e.g. "a heart of gold" over "heart of gold")
  const dedupedPhrases: ExtractedVocabulary[] = []
  const sortedPhrases = [...phrasesList].sort(
    (a, b) => b.word.length - a.word.length,
  )

  for (const item of sortedPhrases) {
    const textCore = item.word
      .toLowerCase()
      .replace(/^(?:to\s+(?:be\s+)?|a\s+|an\s+|the\s+|as\s+)/, '')
      .trim()
    const existing = dedupedPhrases.find((r) => {
      const rCore = r.word
        .toLowerCase()
        .replace(/^(?:to\s+(?:be\s+)?|a\s+|an\s+|the\s+|as\s+)/, '')
        .trim()
      return rCore === textCore || rCore.includes(textCore)
    })

    if (existing) {
      if (!existing.hint && item.hint) existing.hint = item.hint
      if (!existing.image && item.image) existing.image = item.image
      if (!existing.pron && item.pron) existing.pron = item.pron
    } else {
      dedupedPhrases.push(item)
    }
  }

  dedupedPhrases.sort((a, b) => a.word.localeCompare(b.word))
  wordsList.sort((a, b) => a.word.localeCompare(b.word))

  return {
    words: wordsList.map((w) => w.word),
    phrases: dedupedPhrases.map((p) => p.word),
    vocabularyList: [...wordsList, ...dedupedPhrases],
  }
}

function extractGrammarNotes(
  unit: EssentialEnglishUnit,
  _datasetUrl: string,
): ExtractedNote[] {
  const notes: ExtractedNote[] = []
  const readings = unit.reading ?? []

  // 1. Process story sections (A, B, C, D...)
  for (let i = 0; i < readings.length; i++) {
    const r = readings[i]
    if (r.type === 'story') {
      const sectionLetter = r.en?.trim() || String.fromCharCode(65 + i)
      const storyHtml = r.story ?? ''

      let sectionTitle = `Mục ${sectionLetter}`
      const firstStrong = storyHtml.match(/<strong>(.*?)<\/strong>/i)
      const firstP = storyHtml.match(/<p>(.*?)<\/p>/i)
      if (firstStrong) {
        const cleanStrong = cleanHtmlText(firstStrong[1])
        if (cleanStrong.length >= 3 && cleanStrong.length <= 50) {
          sectionTitle = `Mục ${sectionLetter}: ${cleanStrong}`
        }
      } else if (firstP) {
        const cleanP = cleanHtmlText(firstP[1])
        if (cleanP.length >= 3 && cleanP.length <= 60) {
          sectionTitle = `Mục ${sectionLetter}: ${cleanP}`
        }
      }

      const rawLines = storyHtml
        .split(/<\/(?:p|li|div|h[1-6])>|<br\s*\/?>/i)
        .map((l) => cleanHtmlText(l))
        .filter(
          (l) =>
            l.length > 10 &&
            !l.includes('.jpg') &&
            !l.includes('.png') &&
            !l.includes('speaker_louder') &&
            !/^(?:positive|negative|noun|verb|adjective|adverb|examples?)$/i.test(
              l,
            ),
        )

      if (rawLines.length > 0) {
        notes.push({
          id: `note-sec-${sectionLetter.toLowerCase()}`,
          title: sectionTitle,
          sectionLetter,
          content: rawLines.slice(0, 10),
          rawHtml: storyHtml,
        })
      }
    } else if (r.type === 'faq') {
      // 2. Process exercises
      let exHtml = r.story ?? ''
      // Replace elements with value="..." to [answer]
      exHtml = exHtml.replace(
        /<[^>]+value=(?:"([^"]+)"|'([^']+)')(?:\s*h4index=["'][^"']*["'])?[^>]*>(?:___+|.*?<\/[^>]+>)?/gi,
        (_match, v1, v2) => {
          const val = v1 || v2 || ''
          return ` [${cleanHtmlText(val)}] `
        },
      )

      const cleanLines = exHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|div|h[1-6]|li)>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&nbsp;/g, ' ')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 6)

      if (cleanLines.length > 0) {
        notes.push({
          id: 'note-exercises',
          title: 'Bài tập củng cố (Exercises)',
          sectionLetter: 'Ex',
          content: cleanLines.slice(0, 25),
          rawHtml: r.story,
        })
      }
    }
  }

  return notes
}

export function extractNotes(
  unit: EssentialEnglishUnit,
  extractedPhrases: string[] = [],
  isGrammar?: boolean,
  datasetUrl?: string,
): ExtractedNote[] {
  if (isGrammar || isGrammarDataset(unit, datasetUrl)) {
    return extractGrammarNotes(unit, datasetUrl || '')
  }

  const notes: ExtractedNote[] = []
  const story = unit.reading?.[0]?.story
  if (!story) return notes

  const phraseSet = new Set(extractedPhrases.map((p) => p.toLowerCase()))
  const sectionParts = story.split(/<div class="section-rotate">/i)

  if (sectionParts.length > 1) {
    for (let i = 1; i < sectionParts.length; i++) {
      const part = sectionParts[i]
      const headerMatch = part.match(/<span>([^<]+)<\/span>/i)
      const rawTitle = headerMatch
        ? cleanHtmlText(headerMatch[1])
        : `Section ${i}`

      const letterMatch = rawTitle.match(/^([A-Z])\s*‣/i)
      const sectionLetter = letterMatch
        ? letterMatch[1].toUpperCase()
        : undefined

      const rawLines = part
        .split(/<\/(?:p|li|div|h[1-6])>|<br\s*\/?>/i)
        .map((l) => cleanHtmlText(l))
        .filter(
          (l) =>
            l.length > 15 &&
            !l.includes('.jpg') &&
            !l.includes('.png') &&
            !l.includes('speaker_louder') &&
            !/^(?:positive|negative|noun|verb|adjective|adverb|examples?)$/i.test(
              l,
            ) &&
            !phraseSet.has(l.toLowerCase()),
        )

      // Only keep lines that are substantive (rules, tips, or full sentence explanations)
      const substantive = rawLines.filter((l) => l.split(/\s+/).length >= 5)

      if (substantive.length > 0) {
        notes.push({
          id: `note-sec-${i}`,
          title: rawTitle,
          sectionLetter,
          content: substantive.slice(0, 10),
          rawHtml: part,
        })
      }
    }
  }

  return notes
}

/** URL do người dùng nhập: chỉ http(s) tới máy chủ công khai, không cho đọc mạng nội bộ */
function assertPublicUrl(raw: string) {
  const u = new URL(raw)
  const host = u.hostname.toLowerCase()
  const isPrivate =
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    /^(?:127|10|0)\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === '[::1]' ||
    host.startsWith('[f')
  if (!/^https?:$/.test(u.protocol) || isPrivate) {
    throw new Error('Chỉ hỗ trợ URL http(s) công khai')
  }
}

export async function analyzeLessonUrl(
  options: LessonTargetOptions | string,
): Promise<LessonAnalysis> {
  const { unitNumber, datasetUrl, bookSlug, sourceUrl } =
    parseLessonTarget(options)

  assertPublicUrl(datasetUrl)
  const response = await fetch(datasetUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 AnkiDeckBuilder/1.0',
      accept: 'application/json,text/plain;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(
      `Could not load vocabulary dataset from ${datasetUrl} (HTTP ${response.status})`,
    )
  }

  const dataset = (await response.json()) as EssentialEnglishDataset
  const unit = findUnit(dataset, unitNumber)

  if (!unit) {
    throw new Error(
      `Unit ${unitNumber} was not found in the vocabulary dataset`,
    )
  }

  const isGrammar = isGrammarDataset(unit, bookSlug || datasetUrl)
  const { words, phrases, vocabularyList } = extractPhrasesAndWords(
    unit,
    datasetUrl,
    bookSlug,
  )
  const notes = extractNotes(unit, phrases, isGrammar, datasetUrl)

  const rawUnitTitle = normalizeText(unit.en ?? `Unit ${unitNumber}`)
  const matchedBook = PRESET_BOOKS.find((b) => b.slug === bookSlug)
  const bookTitle =
    matchedBook?.title ||
    (isGrammar ? 'English Grammar in Use' : 'English Vocabulary in Use')

  return {
    sourceUrl,
    resolvedUrl: datasetUrl,
    bookSlug,
    bookTitle,
    unitNumber,
    unitTitle: rawUnitTitle,
    title: rawUnitTitle,
    words,
    phrases,
    vocabularyList,
    notes,
    isGrammar,
  }
}
