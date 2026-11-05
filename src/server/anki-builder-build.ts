/**
 * Dựng gói .apkg từ thẻ do trình tạo Anki sinh ra: tải ảnh (Bing) và audio (Youdao, giọng Anh) về nhúng offline.
 * Bố cục thẻ lấy từ repo essentialenglish2ank (CSS dùng chung với card-template.ts).
 */
import { bingImageUrl, youdaoVoiceUrl } from '#/lib/anki-builder.ts'
import type {
  AnyAnkiCard,
  NoteCard,
  VocabularyCard,
} from '#/lib/anki-builder.ts'
import { audioButton, escapeHtml, posInfo } from './anki/card-template.ts'
import { mediaDownloader } from './anki/media.ts'
import type { Download, Downloaded } from './anki/media.ts'
import { writeApkg } from './anki/export.ts'
import type { ApkgRow } from './anki/export.ts'

const safeBase = (value: string, index: number) =>
  `${String(index + 1).padStart(3, '0')}-${
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'card'
  }`

interface Prepared {
  front: string
  back: string
  tags: string[]
  sort: string
  media: Array<{ name: string; data: Uint8Array }>
}

/** tải audio của text theo URL đã có, lỗi thì thử lại bằng URL Youdao chuẩn */
async function audioFor(
  download: Download,
  url: string | undefined,
  text: string,
) {
  const fallback = youdaoVoiceUrl(text)
  const wanted = (url ?? '').replace(/([?&]type=)2\b/, '$11') || fallback
  if (!wanted) return null
  return (
    (await download(wanted, 'mp3')) ??
    (fallback && fallback !== wanted ? await download(fallback, 'mp3') : null)
  )
}

async function prepareVocabulary(
  card: VocabularyCard,
  index: number,
  download: Download,
): Promise<Prepared> {
  const word = card.word.trim() || 'word'
  const base = safeBase(word, index)
  const media: Prepared['media'] = []
  const example = card.example.trim()
  const chunks = card.chunks ?? []

  const imageUrl =
    card.imageUrl.trim() ||
    (card.imageQuery ? bingImageUrl(card.imageQuery) : '')
  const [image, wordAudio, exampleAudio, chunkAudio] = await Promise.all([
    (async () =>
      imageUrl
        ? ((await download(imageUrl, 'jpg')) ??
          (card.imageQuery
            ? await download(bingImageUrl(card.imageQuery, true), 'jpg')
            : null))
        : null)(),
    audioFor(download, card.wordAudioUrl, word),
    example ? audioFor(download, card.exampleAudioUrl, example) : null,
    Promise.all(
      chunks.map((c) =>
        c.text.trim() ? audioFor(download, c.audioUrl, c.text.trim()) : null,
      ),
    ),
  ])

  const add = (name: string, d: Downloaded | null) => {
    if (!d) return ''
    const file = `${name}.${d.ext}`
    media.push({ name: file, data: d.data })
    return file
  }
  const imageFile = add(base, image)
  const imageTag = imageFile
    ? `<img src="${imageFile}" alt="${escapeHtml(word)}" style="max-height:220px;max-width:100%;object-fit:cover;border-radius:8px">`
    : ''
  const wordFile = add(`${base}-word`, wordAudio)
  const wordSound = wordFile ? `[sound:${wordFile}]` : ''
  const exampleFile = add(`${base}-example`, exampleAudio)
  const exampleSound = audioButton(exampleFile || null)
  const chunkSounds = chunkAudio.map((a, i) => {
    const f = add(`${base}-chunk-${i + 1}`, a)
    return audioButton(f || null)
  })

  const chunksHtml = chunks.length
    ? `
      <div class="anki-chunks-box">
        <div class="anki-chunks-title">🧩 <b>Lexical Chunks (Cụm từ đi kèm):</b></div>
        <ul class="anki-chunks-list">
          ${chunks
            .map(
              (c, i) =>
                `<li><span class="anki-chunk-text">${escapeHtml(c.text)}</span>${
                  chunkSounds[i]
                    ? ` <span class="anki-chunk-audio">${chunkSounds[i]}</span>`
                    : ''
                }${
                  c.ipa
                    ? ` <span class="anki-chunk-ipa" style="color:var(--anki-muted,#64748b);font-size:12px;font-family:ui-monospace,monospace;">${escapeHtml(c.ipa)}</span>`
                    : ''
                }${c.meaningVi ? ` <span class="anki-chunk-meaning">— ${escapeHtml(c.meaningVi)}</span>` : ''}${
                  c.example
                    ? `<div style="font-size:12px;color:var(--anki-muted,#64748b);font-style:italic;margin-top:2px;padding-left:4px;">${escapeHtml(c.example)}</div>`
                    : ''
                }</li>`,
            )
            .join('')}
        </ul>
      </div>`
    : ''

  const isPhrase = card.kind === 'phrase' || word.includes(' ')
  const pos = posInfo(card.partOfSpeech || (isPhrase ? 'phrase' : 'noun'))
  const badge = `<div class="anki-badge ${pos.cls}">${escapeHtml(pos.labelVi)} • ${escapeHtml(pos.abbr)}</div>`
  const image$ = imageTag
    ? `<div class="anki-image-wrapper">${imageTag}</div>`
    : ''

  const front = `
    <div class="anki-container">
      ${badge}
      ${image$}
      <div class="anki-word">${escapeHtml(word)}</div>
      <div style="margin-top:12px">${wordSound}</div>
    </div>`
  const back = `
    <div class="anki-container">
      <div>
        ${badge}
        ${image$}
        <div class="anki-word">${escapeHtml(word)}</div>
        <div class="anki-ipa">${escapeHtml(card.ipa)} ${wordSound}</div>
      </div>
      <div class="anki-box">
        <div class="anki-vn"><b>🇻🇳</b> ${escapeHtml(card.vietnamese)}</div>
        <div class="anki-en"><b>English:</b> ${escapeHtml(card.englishDefinition)}</div>
        ${card.hint ? `<div class="anki-hint"><b>💡 Textbook Note:</b> <i>${escapeHtml(card.hint)}</i></div>` : ''}
      </div>
      ${chunksHtml}
      <div class="anki-example-box">
        <div class="anki-example-text"><i>${escapeHtml(example)}</i> ${exampleSound}</div>
      </div>
    </div>`

  const tags = [
    'vocabulary',
    card.unitNumber
      ? `unit-${String(card.unitNumber).padStart(2, '0')}`
      : 'vocabulary-list',
  ]
  if (isPhrase) tags.push('phrases')
  return { front, back, tags, sort: word, media }
}

async function prepareNote(
  card: NoteCard,
  index: number,
  download: Download,
): Promise<Prepared> {
  const title = card.title.trim() || 'Note'
  const base = safeBase(`note-${title}`, index)
  const media: Prepared['media'] = []
  const example = card.example.trim()
  let exampleSound = ''
  if (example) {
    const a = await audioFor(download, card.exampleAudioUrl, example)
    if (a) {
      const file = `${base}-example.${a.ext}`
      media.push({ name: file, data: a.data })
      exampleSound = audioButton(file)
    }
  }
  const isExercises = /exercise|bài tập/i.test(title)
  const isGrammar = /mục\s+[A-Z]|grammar/i.test(title)
  const badgeText = isExercises
    ? 'PRACTICE EXERCISES'
    : isGrammar
      ? 'GRAMMAR RULE'
      : 'LANGUAGE NOTE'
  const subTitle = isExercises
    ? 'Exercise questions &amp; answers'
    : isGrammar
      ? 'Grammar formula &amp; contrastive usage'
      : 'Key phrases &amp; usage rules'
  const badge = `<div class="anki-badge anki-badge-note">${badgeText}</div>`

  const front = `
    <div class="anki-container" style="padding:24px 14px">
      ${badge}
      <div class="anki-word" style="font-size:26px">${escapeHtml(title)}</div>
      <div class="anki-ipa" style="margin-top:10px">${subTitle}</div>
    </div>`
  const back = `
    <div class="anki-container">
      ${badge}
      <div class="anki-word" style="font-size:24px;margin-bottom:14px">${escapeHtml(title)}</div>
      <div class="anki-box">
        <div style="font-size:12px;font-weight:700;color:var(--anki-muted,#64748b);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">
          Important phrases &amp; expressions:
        </div>
        <ul style="margin:0;padding-left:22px;color:var(--anki-box-text,#0f172a)">
          ${card.content.map((item) => `<li style="margin-bottom:6px">${escapeHtml(item)}</li>`).join('')}
        </ul>
      </div>
      ${
        card.vietnameseExplanation
          ? `<div class="anki-note-vn"><div><b>🇻🇳 Giải thích:</b> ${escapeHtml(card.vietnameseExplanation)}</div></div>`
          : ''
      }
      ${
        example
          ? `<div class="anki-example-box">
        <div style="font-size:12px;font-weight:700;color:var(--anki-example-border,#3b82f6);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Example in context:</div>
        <div class="anki-example-text"><i>${escapeHtml(example)}</i> ${exampleSound}</div>
      </div>`
          : ''
      }
    </div>`
  return {
    front,
    back,
    tags: [
      'language-notes',
      card.unitNumber
        ? `unit-${String(card.unitNumber).padStart(2, '0')}`
        : 'notes',
    ],
    sort: title,
    media,
  }
}

export async function buildGeneratedApkg(
  deckName: string,
  cards: AnyAnkiCard[],
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const download = mediaDownloader()
  const prepared: Prepared[] = new Array(cards.length)
  let next = 0
  let done = 0
  const workers = Array.from(
    { length: Math.min(cards.length, 8) },
    async () => {
      while (next < cards.length) {
        const i = next++
        const c = cards[i]
        prepared[i] =
          c.type === 'note'
            ? await prepareNote(c, i, download)
            : await prepareVocabulary(c, i, download)
        onProgress?.(++done, cards.length)
      }
    },
  )
  await Promise.all(workers)

  const media = new Map<string, Uint8Array>()
  const rows: ApkgRow[] = prepared.map((p, i) => {
    for (const m of p.media) media.set(m.name, m.data)
    return {
      deck: deckName,
      guid: `builder:${deckName}:${i}:${p.sort}`,
      fields: [p.front, p.back],
      sort: p.sort,
      tags: p.tags,
    }
  })
  return writeApkg(rows, media)
}
