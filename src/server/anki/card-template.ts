/**
 * Giao diện thẻ Anki khi xuất .apkg: badge loại từ, ảnh, IPA + audio, hộp nghĩa Việt/English,
 * khung Lexical Chunks, câu ví dụ; có dark mode của Anki. Bố cục và CSS lấy từ repo essentialenglish2ank.
 */
import type { CardInfo } from '#/db/schema.ts'

export const CARD_CSS = `
.card {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  text-align: center;
  font-size: 16px;
  background-color: var(--anki-bg, #ffffff);
  color: var(--anki-text, #0f172a);
}

:root {
  --anki-bg: #ffffff;
  --anki-text: #0f172a;
  --anki-muted: #64748b;
  --anki-box-bg: #f8fafc;
  --anki-box-border: #e2e8f0;
  --anki-box-text: #0f172a;
  --anki-box-desc: #334155;
  --anki-example-bg: #eff6ff;
  --anki-example-border: #3b82f6;
  --anki-example-text: #1e293b;
  --anki-note-bg: #f0fdf4;
  --anki-note-border: #22c55e;
  --anki-note-text: #166534;
  --anki-badge-vocab-bg: #e0f2fe;
  --anki-badge-vocab-text: #0369a1;
  --anki-badge-phrase-bg: #f3e8ff;
  --anki-badge-phrase-text: #7e22ce;
  --anki-badge-note-bg: #fef3c7;
  --anki-badge-note-text: #b45309;
}

/* Anki Dark Mode / Night Mode (Anki Desktop, AnkiDroid, AnkiMobile) */
.nightMode.card,
.nightMode .card,
.night_mode .card,
body.nightMode,
body.night_mode,
.nightMode,
.night_mode {
  background-color: #1e1e1e !important;
  color: #f8fafc !important;
  --anki-bg: #1e1e1e;
  --anki-text: #f8fafc;
  --anki-muted: #94a3b8;
  --anki-box-bg: #282a2e;
  --anki-box-border: #3f444e;
  --anki-box-text: #f8fafc;
  --anki-box-desc: #cbd5e1;
  --anki-example-bg: #1e293b;
  --anki-example-border: #60a5fa;
  --anki-example-text: #f1f5f9;
  --anki-note-bg: #143522;
  --anki-note-border: #4ade80;
  --anki-note-text: #bbf7d0;
  --anki-badge-vocab-bg: #075985;
  --anki-badge-vocab-text: #bae6fd;
  --anki-badge-phrase-bg: #581c87;
  --anki-badge-phrase-text: #e9d5ff;
  --anki-badge-note-bg: #78350f;
  --anki-badge-note-text: #fde68a;
}

@media (prefers-color-scheme: dark) {
  .card {
    background-color: #1e1e1e;
    color: #f8fafc;
  }
  :root {
    --anki-bg: #1e1e1e;
    --anki-text: #f8fafc;
    --anki-muted: #94a3b8;
    --anki-box-bg: #282a2e;
    --anki-box-border: #3f444e;
    --anki-box-text: #f8fafc;
    --anki-box-desc: #cbd5e1;
    --anki-example-bg: #1e293b;
    --anki-example-border: #60a5fa;
    --anki-example-text: #f1f5f9;
    --anki-note-bg: #143522;
    --anki-note-border: #4ade80;
    --anki-note-text: #bbf7d0;
    --anki-badge-vocab-bg: #075985;
    --anki-badge-vocab-text: #bae6fd;
    --anki-badge-phrase-bg: #581c87;
    --anki-badge-phrase-text: #e9d5ff;
    --anki-badge-note-bg: #78350f;
    --anki-badge-note-text: #fde68a;
  }
}

.anki-container {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  text-align: center;
  padding: 14px 10px;
  line-height: 1.5;
  max-width: 560px;
  margin: 0 auto;
  color: var(--anki-text, #0f172a);
}

.anki-word {
  font-size: 32px;
  font-weight: 700;
  color: var(--anki-text, #0f172a);
  margin: 10px 0 6px 0;
  line-height: 1.25;
}

.anki-ipa {
  font-size: 18px;
  color: var(--anki-muted, #64748b);
  margin: 4px 0 14px 0;
}

.anki-box {
  background: var(--anki-box-bg, #f8fafc);
  border: 1px solid var(--anki-box-border, #e2e8f0);
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 14px;
  text-align: left;
}

.anki-vn {
  font-size: 18px;
  color: var(--anki-box-text, #0f172a);
  margin-bottom: 8px;
  font-weight: 600;
}

.anki-en {
  font-size: 15px;
  color: var(--anki-box-desc, #334155);
}

.anki-hint {
  font-size: 13px;
  color: var(--anki-muted, #64748b);
  margin-top: 6px;
  font-style: italic;
}

.anki-example-box {
  background: var(--anki-example-bg, #eff6ff);
  border-left: 4px solid var(--anki-example-border, #3b82f6);
  border-radius: 0 8px 8px 0;
  padding: 12px 16px;
  text-align: left;
}

.anki-example-text {
  font-size: 15px;
  color: var(--anki-example-text, #1e293b);
  font-style: italic;
}

.anki-note-vn {
  background: var(--anki-note-bg, #f0fdf4);
  border-left: 4px solid var(--anki-note-border, #22c55e);
  border-radius: 0 8px 8px 0;
  padding: 12px 16px;
  margin-bottom: 14px;
  text-align: left;
  font-size: 15px;
  color: var(--anki-note-text, #166534);
}

.anki-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
  line-height: normal;
}

.anki-badge-vocab {
  background: var(--anki-badge-vocab-bg, #e0f2fe);
  color: var(--anki-badge-vocab-text, #0369a1);
}

.anki-badge-phrase {
  background: var(--anki-badge-phrase-bg, #f3e8ff);
  color: var(--anki-badge-phrase-text, #7e22ce);
}

.anki-badge-note {
  background: var(--anki-badge-note-bg, #fef3c7);
  color: var(--anki-badge-note-text, #b45309);
}

.anki-badge-pos {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
}

.anki-pos-adj {
  background: #fef3c7;
  color: #b45309;
}
.anki-pos-adv {
  background: #ccfbf1;
  color: #0f766e;
}
.anki-pos-noun {
  background: #e0f2fe;
  color: #0369a1;
}
.anki-pos-verb {
  background: #dcfce7;
  color: #15803d;
}
.anki-pos-phrase {
  background: #f3e8ff;
  color: #7e22ce;
}
.anki-pos-phrv {
  background: #e0e7ff;
  color: #4338ca;
}
.anki-pos-idiom {
  background: #fce7f3;
  color: #be185d;
}
.anki-pos-prep, .anki-pos-default {
  background: #f1f5f9;
  color: #475569;
}

.anki-chunks-box {
  margin-top: 12px;
  background: var(--anki-box-bg, #f8fafc);
  border: 1px solid var(--anki-box-border, #e2e8f0);
  border-radius: 8px;
  padding: 10px 14px;
  text-align: left;
}

.anki-chunks-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--anki-muted, #475569);
  margin-bottom: 6px;
}

.anki-chunks-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.6;
}

.anki-chunk-text {
  font-weight: 600;
  color: #0369a1;
}

.anki-chunk-meaning {
  color: var(--anki-muted, #475569);
}

.anki-chunk-audio {
  display: inline-block;
  margin: 0 4px;
  vertical-align: middle;
}

.anki-image-wrapper {
  max-width: 340px;
  margin: 0 auto 16px auto;
}

/* Explicit Night Mode overrides with !important */
.nightMode .anki-pos-adj, .night_mode .anki-pos-adj, body.nightMode .anki-pos-adj, body.night_mode .anki-pos-adj {
  background: #78350f !important;
  color: #fde68a !important;
}
.nightMode .anki-pos-adv, .night_mode .anki-pos-adv, body.nightMode .anki-pos-adv, body.night_mode .anki-pos-adv {
  background: #134e4a !important;
  color: #5eead4 !important;
}
.nightMode .anki-pos-noun, .night_mode .anki-pos-noun, body.nightMode .anki-pos-noun, body.night_mode .anki-pos-noun {
  background: #075985 !important;
  color: #bae6fd !important;
}
.nightMode .anki-pos-verb, .night_mode .anki-pos-verb, body.nightMode .anki-pos-verb, body.night_mode .anki-pos-verb {
  background: #14532d !important;
  color: #86efac !important;
}
.nightMode .anki-pos-phrase, .night_mode .anki-pos-phrase, body.nightMode .anki-pos-phrase, body.night_mode .anki-pos-phrase {
  background: #581c87 !important;
  color: #e9d5ff !important;
}
.nightMode .anki-pos-phrv, .night_mode .anki-pos-phrv, body.nightMode .anki-pos-phrv, body.night_mode .anki-pos-phrv {
  background: #312e81 !important;
  color: #c7d2fe !important;
}
.nightMode .anki-pos-idiom, .night_mode .anki-pos-idiom, body.nightMode .anki-pos-idiom, body.night_mode .anki-pos-idiom {
  background: #831843 !important;
  color: #fbcfe8 !important;
}
.nightMode .anki-pos-prep, .night_mode .anki-pos-prep, .nightMode .anki-pos-default, .night_mode .anki-pos-default, body.nightMode .anki-pos-prep, body.night_mode .anki-pos-prep {
  background: #334155 !important;
  color: #e2e8f0 !important;
}

.nightMode .anki-word,
.night_mode .anki-word,
body.nightMode .anki-word,
body.night_mode .anki-word {
  color: #f8fafc !important;
}

.nightMode .anki-ipa,
.night_mode .anki-ipa,
body.nightMode .anki-ipa,
body.night_mode .anki-ipa,
.nightMode .anki-hint,
.night_mode .anki-hint,
body.nightMode .anki-hint,
body.night_mode .anki-hint {
  color: #94a3b8 !important;
}

.nightMode .anki-box,
.night_mode .anki-box,
body.nightMode .anki-box,
body.night_mode .anki-box {
  background: #282a2e !important;
  border-color: #3f444e !important;
}

.nightMode .anki-vn,
.night_mode .anki-vn,
body.nightMode .anki-vn,
body.night_mode .anki-vn {
  color: #f8fafc !important;
}

.nightMode .anki-en,
.night_mode .anki-en,
body.nightMode .anki-en,
body.night_mode .anki-en {
  color: #cbd5e1 !important;
}

.nightMode .anki-example-box,
.night_mode .anki-example-box,
body.nightMode .anki-example-box,
body.night_mode .anki-example-box {
  background: #1e293b !important;
  border-left-color: #60a5fa !important;
}

.nightMode .anki-example-text,
.night_mode .anki-example-text,
body.nightMode .anki-example-text,
body.night_mode .anki-example-text {
  color: #f1f5f9 !important;
}

.nightMode .anki-note-vn,
.night_mode .anki-note-vn,
body.nightMode .anki-note-vn,
body.night_mode .anki-note-vn {
  background: #143522 !important;
  border-left-color: #4ade80 !important;
  color: #bbf7d0 !important;
}

.nightMode .anki-badge-vocab,
.night_mode .anki-badge-vocab,
body.nightMode .anki-badge-vocab,
body.night_mode .anki-badge-vocab {
  background: #075985 !important;
  color: #bae6fd !important;
}

.nightMode .anki-badge-phrase,
.night_mode .anki-badge-phrase,
body.nightMode .anki-badge-phrase,
body.night_mode .anki-badge-phrase {
  background: #581c87 !important;
  color: #e9d5ff !important;
}

.nightMode .anki-badge-note,
.night_mode .anki-badge-note,
body.nightMode .anki-badge-note,
body.night_mode .anki-badge-note {
  background: #78350f !important;
  color: #fde68a !important;
}

.nightMode .anki-chunks-box,
.night_mode .anki-chunks-box,
body.nightMode .anki-chunks-box,
body.night_mode .anki-chunks-box {
  background: #1e293b !important;
  border-color: #334155 !important;
}

.nightMode .anki-chunks-title,
.night_mode .anki-chunks-title,
body.nightMode .anki-chunks-title,
body.night_mode .anki-chunks-title {
  color: #94a3b8 !important;
}

.nightMode .anki-chunks-list,
.night_mode .anki-chunks-list,
body.nightMode .anki-chunks-list,
body.night_mode .anki-chunks-list {
  color: #e2e8f0 !important;
}

.nightMode .anki-chunk-text,
.night_mode .anki-chunk-text,
body.nightMode .anki-chunk-text,
body.night_mode .anki-chunk-text {
  color: #38bdf8 !important;
}

.nightMode .anki-chunk-meaning,
.night_mode .anki-chunk-meaning,
body.nightMode .anki-chunk-meaning,
body.night_mode .anki-chunk-meaning {
  color: #94a3b8 !important;
}

.anki-audio {
  height: 28px;
  width: 150px;
  max-width: 100%;
  vertical-align: middle;
}
`

interface PosInfo {
  abbr: string
  labelVi: string
  cls: string
}

const POS: Record<string, PosInfo> = {
  adjective: { abbr: 'adj.', labelVi: 'Tính từ', cls: 'anki-pos-adj' },
  adverb: { abbr: 'adv.', labelVi: 'Trạng từ', cls: 'anki-pos-adv' },
  noun: { abbr: 'n.', labelVi: 'Danh từ', cls: 'anki-pos-noun' },
  verb: { abbr: 'v.', labelVi: 'Động từ', cls: 'anki-pos-verb' },
  'phrasal verb': {
    abbr: 'phr. v.',
    labelVi: 'Cụm động từ',
    cls: 'anki-pos-phrv',
  },
  phrase: { abbr: 'phr.', labelVi: 'Cụm từ', cls: 'anki-pos-phrase' },
  idiom: { abbr: 'idiom', labelVi: 'Thành ngữ', cls: 'anki-pos-idiom' },
  preposition: { abbr: 'prep.', labelVi: 'Giới từ', cls: 'anki-pos-prep' },
  conjunction: { abbr: 'conj.', labelVi: 'Liên từ', cls: 'anki-pos-default' },
  pronoun: { abbr: 'pron.', labelVi: 'Đại từ', cls: 'anki-pos-default' },
  interjection: { abbr: 'int.', labelVi: 'Thán từ', cls: 'anki-pos-default' },
}

/** "adj." / "danh từ" / "phrasal verb"… → mã loại từ; '' nếu không nhận ra */
function posCode(raw: string): string {
  const c = raw.toLowerCase().trim()
  if (/^adj\b|adjective|tính/.test(c)) return 'adjective'
  if (/^adv\b|adverb|trạng|phó/.test(c)) return 'adverb'
  if (/phrasal verb|^phr\.? ?v|cụm động/.test(c)) return 'phrasal verb'
  if (/^n\b|noun|danh/.test(c)) return 'noun'
  if (/^v\b|verb|động/.test(c)) return 'verb'
  if (/idiom|thành ngữ/.test(c)) return 'idiom'
  if (/phrase|^phr\b|cụm/.test(c)) return 'phrase'
  if (/^prep\b|preposition|giới/.test(c)) return 'preposition'
  if (/^conj\b|conjunction|liên/.test(c)) return 'conjunction'
  if (/^pron\b|pronoun|đại/.test(c)) return 'pronoun'
  if (/^int\b|interjection|thán/.test(c)) return 'interjection'
  return ''
}

/** nhãn + class CSS của badge loại từ; loại lạ thì dùng nhãn nguyên văn */
export function posInfo(raw: string) {
  const known = POS[posCode(raw)] as PosInfo | undefined
  return known ?? { abbr: raw, labelVi: raw || 'Khác', cls: 'anki-pos-default' }
}

/**
 * Nút nghe không tự phát (khác [sound:…] của Anki luôn tự phát khi hiện mặt sau): dùng cho câu ví dụ và chunk.
 * Nhận tên file trong gói, '' nếu không có audio.
 */
export const audioButton = (file: string | null) =>
  file
    ? `<audio class="anki-audio" controls preload="none" src="${escapeHtml(file)}"></audio>`
    : ''

export const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')

export interface CardParts {
  front: string
  back: string
  guid: string | null
  ipa: string | null
  example: string | null
  extra: string | null
  meaningVi: string | null
  info: CardInfo | null
  /** thẻ ghi chú (Common mistakes / Language help), không phải thẻ từ */
  isNote: boolean
}

interface Media {
  /** <img …> đã dựng sẵn, '' nếu không có ảnh */
  imageTag: string
  /** [sound:…], '' nếu không có audio */
  audioTag: string
  /** audio câu ví dụ */
  exampleSound?: string
  /** audio từng thành ngữ trong info.idioms (cùng thứ tự) */
  chunkSounds?: string[]
}

const NOTE_BADGE = '<div class="anki-badge anki-badge-note">LANGUAGE NOTE</div>'

function renderNote(c: CardParts) {
  const title = escapeHtml(c.front)
  const front = `
    <div class="anki-container" style="padding:24px 14px">
      ${NOTE_BADGE}
      <div class="anki-word" style="font-size:26px">${title}</div>
      <div class="anki-ipa" style="margin-top:10px">Key phrases &amp; usage rules</div>
    </div>`
  const back = `
    <div class="anki-container">
      ${NOTE_BADGE}
      <div class="anki-word" style="font-size:24px;margin-bottom:14px">${title}</div>
      <div class="anki-box">
        <ul style="margin:0;padding-left:22px;color:var(--anki-box-text,#0f172a)">
          ${c.back
            .split('\n')
            .map((l) => `<li style="margin-bottom:6px">${escapeHtml(l)}</li>`)
            .join('')}
        </ul>
      </div>
    </div>`
  return { front, back, tags: ['language-notes'] }
}

const chunkLine = (
  text: string,
  meaning: string,
  example?: string,
  sound?: string,
) =>
  `<li><span class="anki-chunk-text">${escapeHtml(text)}</span>${sound ? ` <span class="anki-chunk-audio">${sound}</span>` : ''}${
    meaning
      ? ` <span class="anki-chunk-meaning">— ${escapeHtml(meaning)}</span>`
      : ''
  }${
    example
      ? `<div style="font-size:12px;color:var(--anki-muted,#64748b);font-style:italic;margin-top:2px;padding-left:4px;">${escapeHtml(example)}</div>`
      : ''
  }</li>`

/** HTML mặt trước/sau của một thẻ */
export function renderCard(c: CardParts, media: Media) {
  if (c.isNote) return renderNote(c)

  const word = c.front.trim()
  const isPhrase = word.includes(' ')
  // extra có dạng "adj. · Unit 1": chỉ lấy phần đầu khi đó đúng là loại từ
  const extraPos = c.extra?.split(' · ')[0] ?? ''
  const code =
    posCode(c.info?.pos ?? '') ||
    posCode(extraPos) ||
    (isPhrase ? 'phrase' : 'noun')
  const pos = POS[code]
  const badge = `<div class="anki-badge ${pos.cls}">${pos.labelVi} • ${pos.abbr}</div>`

  const image = media.imageTag
    ? `<div class="anki-image-wrapper">${media.imageTag}</div>`
    : ''
  // thẻ sách không có định nghĩa thì back là tên unit (extra có 1 phần) → không hiện làm "English"
  const hasDefinition =
    !c.guid?.startsWith('ee:') || (c.extra?.includes(' · ') ?? false)
  const definition = hasDefinition && c.back !== c.meaningVi ? c.back : ''

  const chunks = [
    ...(c.info?.idioms ?? []).map((i, n) =>
      chunkLine(i.en, i.vi, undefined, media.chunkSounds?.[n]),
    ),
    ...(c.info?.collocations ?? []).map((k, n) =>
      chunkLine(
        k.words,
        k.type,
        k.example,
        media.chunkSounds?.[(c.info?.idioms.length ?? 0) + n],
      ),
    ),
  ].slice(0, 5)
  const chunksHtml = chunks.length
    ? `
      <div class="anki-chunks-box">
        <div class="anki-chunks-title">🧩 <b>Lexical Chunks (Cụm từ đi kèm):</b></div>
        <ul class="anki-chunks-list">${chunks.join('')}</ul>
      </div>`
    : ''

  const example = c.example?.split('\n')[0] || c.info?.examples[0]?.en || ''
  const exampleVi = c.example ? '' : (c.info?.examples[0]?.vi ?? '')

  const front = `
    <div class="anki-container">
      ${badge}
      ${image}
      <div class="anki-word">${escapeHtml(word)}</div>
      <div style="margin-top:12px">${media.audioTag}</div>
    </div>`

  const back = `
    <div class="anki-container">
      <div>
        ${badge}
        ${image}
        <div class="anki-word">${escapeHtml(word)}</div>
        <div class="anki-ipa">${escapeHtml(c.ipa ?? '')} ${media.audioTag}</div>
      </div>
      ${
        c.meaningVi || definition
          ? `<div class="anki-box">
        ${c.meaningVi ? `<div class="anki-vn"><b>🇻🇳</b> ${escapeHtml(c.meaningVi).replaceAll('\n', '<br>')}</div>` : ''}
        ${definition ? `<div class="anki-en"><b>English:</b> ${escapeHtml(definition).replaceAll('\n', '<br>')}</div>` : ''}
      </div>`
          : ''
      }
      ${chunksHtml}
      ${
        example
          ? `<div class="anki-example-box">
        <div class="anki-example-text"><i>${escapeHtml(example)}</i> ${media.exampleSound ?? ''}</div>
        ${exampleVi ? `<div class="anki-hint">${escapeHtml(exampleVi)}</div>` : ''}
      </div>`
          : ''
      }
    </div>`

  return { front, back, tags: ['vocabulary', ...(isPhrase ? ['phrases'] : [])] }
}
