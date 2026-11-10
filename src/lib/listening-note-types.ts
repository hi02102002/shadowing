export interface TableColumn {
  id: string
  name: string
  headerBg?: string
}

export interface TableRow {
  id: string
  label: string
  isMerged?: boolean
  cells: Record<string, string>
}

export interface CustomTable {
  id: string
  title: string
  labelHeader: string
  headerColor: string
  columns: TableColumn[]
  rows: TableRow[]
}

export interface ListeningNoteSession {
  id: string
  title: string
  audioSourceType: 'url' | 'file' | 'youtube' | 'sample'
  audioUrl: string
  audioFileName?: string
  lastPlaybackTime?: number
  tables: CustomTable[]
  notes: string
  richHtml?: string
  createdAt: number
  updatedAt: number
}

export const HEADER_COLOR_OPTIONS = [
  { id: 'peach', label: 'Cam đào (như mẫu)', value: '#fed7aa', darkValue: '#78350f' },
  { id: 'sky', label: 'Xanh lam', value: '#bae6fd', darkValue: '#0c4a6e' },
  { id: 'emerald', label: 'Xanh lá', value: '#a7f3d0', darkValue: '#064e3b' },
  { id: 'purple', label: 'Tím nhạt', value: '#e9d5ff', darkValue: '#581c87' },
  { id: 'slate', label: 'Xám ghi', value: '#e2e8f0', darkValue: '#334155' },
] as const

/** Mẫu bảng so sánh 2 nhân vật (Neil & Georgie) giống ảnh người dùng cung cấp */
export function createNeilGeorgieTemplate(): CustomTable {
  return {
    id: `table-neil-georgie-${Date.now()}`,
    title: 'Bảng so sánh: Neil & Georgie (Cities)',
    labelHeader: '',
    headerColor: '#fed7aa',
    columns: [
      { id: 'neil', name: 'Neil' },
      { id: 'georgie', name: 'Georgie' },
    ],
    rows: [
      {
        id: 'r1',
        label: 'current city',
        isMerged: true,
        cells: {
          neil: '',
          georgie: '',
        },
      },
      {
        id: 'r2',
        label: 'pros',
        isMerged: true,
        cells: {
          neil: '',
          georgie: '',
        },
      },
      {
        id: 'r3',
        label: 'cons',
        isMerged: true,
        cells: {
          neil: '',
          georgie: '',
        },
      },
      {
        id: 'r4',
        label: 'past cities',
        isMerged: false,
        cells: {
          neil: '1. Madrid\n2. Prague:',
          georgie: '1. Barcelona:\n\n2. Edinburgh:',
        },
      },
      {
        id: 'r5',
        label: 'dream cities to visit',
        isMerged: false,
        cells: {
          neil: 'city:\n\nreason:',
          georgie: 'city:\n\nreason:',
        },
      },
    ],
  }
}

/** Mẫu ghi chú luyện nghe IELTS Note Completion */
export function createIeltsNoteTemplate(): CustomTable {
  return {
    id: `table-ielts-${Date.now()}`,
    title: 'Bảng ghi chú IELTS Listening (Section / Questions)',
    labelHeader: 'Thông tin / Câu hỏi',
    headerColor: '#bae6fd',
    columns: [
      { id: 'clue', name: 'Từ khoá nghe được' },
      { id: 'answer', name: 'Đáp án ghi chú' },
      { id: 'timestamp', name: 'Mốc thời gian' },
    ],
    rows: [
      {
        id: 'r1',
        label: '1. Name of contact',
        isMerged: false,
        cells: { clue: 'spelled out: A-N-D-E-R-S-O-N', answer: 'Anderson', timestamp: '[00:45]' },
      },
      {
        id: 'r2',
        label: '2. Destination',
        isMerged: false,
        cells: { clue: 'capital of Spain', answer: 'Madrid', timestamp: '[01:18]' },
      },
      {
        id: 'r3',
        label: '3. Preferred hotel area',
        isMerged: false,
        cells: { clue: 'close to station', answer: 'Central station', timestamp: '[02:04]' },
      },
      {
        id: 'r4',
        label: '4. Maximum budget',
        isMerged: false,
        cells: { clue: 'per night in euros', answer: '€120', timestamp: '[02:45]' },
      },
    ],
  }
}

/** Mẫu chép chính tả & từ mới */
export function createDictationVocabTemplate(): CustomTable {
  return {
    id: `table-dictation-${Date.now()}`,
    title: 'Bảng chép chính tả & Từ vựng mới',
    labelHeader: 'Mốc thời gian',
    headerColor: '#a7f3d0',
    columns: [
      { id: 'sentence', name: 'Câu nghe được (Dictation)' },
      { id: 'vocab', name: 'Từ / Chunk mới' },
      { id: 'meaning', name: 'Nghĩa & Ghi chú' },
    ],
    rows: [
      {
        id: 'r1',
        label: '[00:30]',
        isMerged: false,
        cells: {
          sentence: 'Living in a bustling city has both pros and cons.',
          vocab: 'bustling city (collocation)',
          meaning: 'thành phố tấp nập, nhộn nhịp',
        },
      },
      {
        id: 'r2',
        label: '[01:15]',
        isMerged: false,
        cells: {
          sentence: 'I was completely captivated by the vibrant architecture.',
          vocab: 'captivated by, vibrant',
          meaning: 'bị cuốn hút bởi..., sống động',
        },
      },
      {
        id: 'r3',
        label: '[02:00]',
        isMerged: false,
        cells: {
          sentence: '',
          vocab: '',
          meaning: '',
        },
      },
    ],
  }
}

/** Tạo bảng trống mới */
export function createBlankTable(cols = 2, rows = 3): CustomTable {
  const columns: TableColumn[] = Array.from({ length: cols }, (_, i) => ({
    id: `col-${i + 1}`,
    name: `Cột ${i + 1}`,
  }))
  const tableRows: TableRow[] = Array.from({ length: rows }, (_, r) => ({
    id: `row-${r + 1}`,
    label: `Mục ${r + 1}`,
    isMerged: false,
    cells: Object.fromEntries(columns.map((c) => [c.id, ''])),
  }))
  return {
    id: `table-blank-${Date.now()}`,
    title: `Bảng ghi chú mới (${cols} cột x ${rows} hàng)`,
    labelHeader: '',
    headerColor: '#fed7aa',
    columns,
    rows: tableRows,
  }
}

/** Tạo phiên ghi chú mặc định */
export function createDefaultSession(): ListeningNoteSession {
  return {
    id: `session-${Date.now()}`,
    title: 'Ghi chú bài nghe: Neil & Georgie (Cities)',
    audioSourceType: 'sample',
    audioUrl: 'https://archive.org/download/6_minute_english_2023_bbc/230105_6_minute_english_smart_cities.mp3',
    audioFileName: 'sample-bbc-6min-cities.mp3',
    lastPlaybackTime: 0,
    tables: [createNeilGeorgieTemplate()],
    notes: `### Ghi chú bài nghe (Listening Notes)
- Bấm vào mốc thời gian dạng \`[00:15]\` hoặc nút ⏱ để tua ngay tới đoạn audio tương ứng.
- Có thể gõ chữ tự do ở đây hoặc điền trực tiếp vào bảng bên trên.
- Bảng hỗ trợ gộp ô ngang, thêm bớt hàng/cột và xuất ra định dạng Markdown / HTML / In ấn.

#### Từ vựng & Điểm đáng chú ý:
- **Pros and cons**: Ưu và nhược điểm
- **Vibrant city**: Thành phố sôi động
- **Dream destination**: Điểm đến mơ ước`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

/** Chuyển đổi timestamp dạng [01:23] hoặc 01:23 hoặc 1:23 sang số giây */
export function parseTimestampToSeconds(text: string): number | null {
  const trimmed = text.replace(/[\[\]]/g, '').trim()
  const match = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const [, a, b, c] = match
  if (c !== undefined) {
    // h:mm:ss
    return parseInt(a, 10) * 3600 + parseInt(b, 10) * 60 + parseInt(c, 10)
  }
  // mm:ss
  return parseInt(a, 10) * 60 + parseInt(b, 10)
}

/** Chuyển số giây thành chuỗi [mm:ss] */
export function formatSecondsToTimestamp(sec: number): string {
  const total = Math.max(0, Math.floor(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}]`
}

/** Chuyển Table sang Markdown */
export function tableToMarkdown(table: CustomTable): string {
  const headers = [table.labelHeader || 'Tiêu chí', ...table.columns.map((c) => c.name)]
  const divider = headers.map(() => '---')
  const rows = table.rows.map((row) => {
    if (row.isMerged) {
      const mergedVal = (row.cells[table.columns[0]?.id ?? ''] ?? '').replace(/\n/g, '<br/>')
      const emptyCells = Array(table.columns.length - 1).fill('')
      return `| **${row.label}** | ${mergedVal} | ${emptyCells.join(' | ')} |`
    }
    const cols = table.columns.map((c) => (row.cells[c.id] ?? '').replace(/\n/g, '<br/>'))
    return `| **${row.label}** | ${cols.join(' | ')} |`
  })
  return [
    `### ${table.title}`,
    `| ${headers.join(' | ')} |`,
    `| ${divider.join(' | ')} |`,
    ...rows,
  ].join('\n')
}

/** Chuyển Table sang HTML có nhúng CSS inline để dán vào Word/Docs */
export function tableToHtml(table: CustomTable): string {
  const bg = table.headerColor || '#fed7aa'
  let html = `<table style="border-collapse: collapse; width: 100%; border: 2px solid #000; font-family: sans-serif;">\n`
  html += `  <thead>\n    <tr style="background-color: ${bg};">\n`
  html += `      <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold; width: 22%;">${table.labelHeader || ''}</th>\n`
  table.columns.forEach((col) => {
    html += `      <th style="border: 1px solid #000; padding: 10px; text-align: center; font-weight: bold;">${col.name}</th>\n`
  })
  html += `    </tr>\n  </thead>\n  <tbody>\n`
  table.rows.forEach((row) => {
    html += `    <tr>\n`
    html += `      <th style="border: 1px solid #000; padding: 10px; text-align: left; font-weight: bold; vertical-align: top; background-color: #fafafa;">${row.label}</th>\n`
    if (row.isMerged) {
      const val = (row.cells[table.columns[0]?.id ?? ''] ?? '').replace(/\n/g, '<br/>')
      html += `      <td colspan="${table.columns.length}" style="border: 1px solid #000; padding: 10px; vertical-align: top;">${val}</td>\n`
    } else {
      table.columns.forEach((col) => {
        const val = (row.cells[col.id] ?? '').replace(/\n/g, '<br/>')
        html += `      <td style="border: 1px solid #000; padding: 10px; vertical-align: top;">${val}</td>\n`
      })
    }
    html += `    </tr>\n`
  })
  html += `  </tbody>\n</table>`
  return html
}

/** Xuất toàn bộ phiên sang Markdown */
export function exportSessionToMarkdown(session: ListeningNoteSession): string {
  const parts: string[] = [
    `# ${session.title}`,
    `*Nguồn audio:* ${session.audioUrl || session.audioFileName || 'Không có'}`,
    `*Thời gian lưu:* ${new Date(session.updatedAt).toLocaleString('vi-VN')}`,
    '',
  ]
  session.tables.forEach((table) => {
    parts.push(tableToMarkdown(table))
    parts.push('')
  })
  if (session.notes.trim()) {
    parts.push('## Ghi chú tự do')
    parts.push(session.notes)
  }
  return parts.join('\n')
}
