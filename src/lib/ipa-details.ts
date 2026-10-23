/**
 * Nội dung trang chi tiết từng âm (/ipa/$soundId), khoá theo `IpaSound.id`.
 * Từ trong `words` dùng `[...]` đánh dấu chữ cái mang âm, giống `IpaSound.examples`.
 */

export interface SoundDetail {
  /** đặc điểm nhanh, hiện thành nhãn */
  traits: string[]
  /** các bước đặt miệng, lưỡi, hơi */
  steps: string[]
  /** lỗi người Việt hay mắc và cách sửa */
  mistakes: Array<{ wrong: string; fix: string }>
  /** từ luyện tập theo vị trí trong từ (phụ âm) hoặc cách viết (nguyên âm) */
  words: Array<{ label: string; items: string[] }>
  /**
   * cặp tối thiểu: [từ có âm này, từ có âm kia].
   * `with` là id của âm kia, hoặc nhãn tự do khi không phải một âm (vd. "không có /h/")
   */
  pairs: Array<{ with: string; items: Array<[string, string]> }>
  /** câu ngắn để ghi âm và chấm */
  phrases: string[]
  /** video YouTube của BBC Learning English (giọng Anh) */
  video: string
}

export const IPA_DETAILS: Record<string, SoundDetail> = {
  // ───────── nguyên âm đơn ─────────
  'long-i': {
    traits: ['Nguyên âm dài', 'Môi bè'],
    steps: [
      'Kéo hai khoé môi sang hai bên như đang cười.',
      'Nâng phần trước lưỡi lên cao, sát vòm miệng nhưng không chạm.',
      'Giữ khẩu hình và kéo dài âm "i" khoảng gấp đôi "i" tiếng Việt.',
    ],
    mistakes: [
      {
        wrong:
          'Đọc ngắn như /ɪ/ nên "sheep" nghe thành "ship", "leave" thành "live".',
        fix: 'Cố ý kéo dài và căng môi hơn. Nói chậm "sheeeep" rồi tăng dần tốc độ.',
      },
    ],
    words: [
      { label: 'Viết ee', items: ['s[ee]', 'tr[ee]', 'gr[ee]n', 'sl[ee]p'] },
      { label: 'Viết ea', items: ['t[ea]', 'b[ea]ch', 'cl[ea]n', 'sp[ea]k'] },
      { label: 'Viết khác', items: ['m[e]', 'p[ie]ce', 'k[ey]', 'mach[i]ne'] },
    ],
    pairs: [
      {
        with: 'short-i',
        items: [
          ['sheep', 'ship'],
          ['leave', 'live'],
          ['seat', 'sit'],
          ['feel', 'fill'],
          ['heel', 'hill'],
        ],
      },
    ],
    phrases: ['Please eat the green peas.', 'We need three cheap seats.'],
    video: 'RZmGzSb-6OM',
  },
  'short-i': {
    traits: ['Nguyên âm ngắn', 'Môi thả lỏng'],
    steps: [
      'Môi thả lỏng, hơi mở, không kéo sang hai bên.',
      'Lưỡi cao nhưng thấp hơn và lùi hơn /iː/ một chút.',
      'Phát âm thật ngắn và gọn, nghe giữa "i" và "ê".',
    ],
    mistakes: [
      {
        wrong:
          'Đọc thành "i" dài và căng như tiếng Việt, "sit" nghe như "seat".',
        fix: 'Thả lỏng hàm và môi, cắt âm thật nhanh.',
      },
      {
        wrong: 'Đuôi -ing đọc thành "inh".',
        fix: 'Đọc /ɪŋ/: "i" ngắn rồi "ng", không chuyển sang "inh".',
      },
    ],
    words: [
      { label: 'Viết i', items: ['s[i]t', 'b[i]g', 'th[i]s', 'w[i]n'] },
      { label: 'Viết y', items: ['g[y]m', 'm[y]th', 's[y]mbol', 'h[y]mn'] },
      {
        label: 'Viết khác',
        items: ['b[u]sy', 'w[o]men', 'pr[e]tty', 'b[ui]ld'],
      },
    ],
    pairs: [
      {
        with: 'long-i',
        items: [
          ['ship', 'sheep'],
          ['live', 'leave'],
          ['fit', 'feet'],
          ['bin', 'bean'],
          ['still', 'steal'],
        ],
      },
    ],
    phrases: ['This is a big city.', 'Six little fish swim in it.'],
    video: 'TNFKG0yvDx4',
  },
  e: {
    traits: ['Nguyên âm ngắn', 'Miệng mở vừa'],
    steps: [
      'Mở miệng vừa phải, rộng hơn /ɪ/.',
      'Lưỡi ở giữa, đầu lưỡi chạm nhẹ răng cửa dưới.',
      'Phát âm ngắn như "e" tiếng Việt.',
    ],
    mistakes: [
      {
        wrong: 'Không phân biệt với /æ/: "bed" và "bad" đọc giống nhau.',
        fix: '/e/ mở miệng vừa, /æ/ hạ hàm dưới sâu hơn hẳn. Đặt tay dưới cằm để cảm nhận.',
      },
    ],
    words: [
      { label: 'Viết e', items: ['b[e]d', 'r[e]d', 't[e]n', 'g[e]t'] },
      {
        label: 'Viết ea',
        items: ['h[ea]d', 'br[ea]d', 'w[ea]ther', 'r[ea]dy'],
      },
      {
        label: 'Viết khác',
        items: ['s[ai]d', 'm[a]ny', 'fr[ie]nd', 'ag[ai]n'],
      },
    ],
    pairs: [
      {
        with: 'ae',
        items: [
          ['bed', 'bad'],
          ['pen', 'pan'],
          ['men', 'man'],
          ['said', 'sad'],
          ['then', 'than'],
        ],
      },
    ],
    phrases: ['Get the red pen, Ben.', 'My friend said yes again.'],
    video: 'hLN1cdSTDo8',
  },
  ae: {
    traits: ['Nguyên âm ngắn', 'Miệng mở rộng'],
    steps: [
      'Hạ hàm dưới xuống thấp, miệng mở rộng.',
      'Kéo khoé môi sang hai bên một chút.',
      'Đầu lưỡi tì vào răng cửa dưới, thân lưỡi dẹt và đẩy ra trước.',
      'Phát âm như đang nói "e" nhưng miệng mở kiểu "a".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "e" (bad → bed) hoặc "a" tiếng Việt (cat → "cát").',
        fix: 'Giữ khẩu hình "a" mở rộng nhưng lưỡi đẩy ra trước như "e". Âm này hơi "bẹt".',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[a]pple', '[a]dd', '[a]ct', '[a]nimal'] },
      { label: 'Giữa từ', items: ['c[a]t', 'h[a]t', 'bl[a]ck', 'h[a]ppy'] },
      { label: 'Viết khác', items: ['b[a]nk', 'pl[ai]d', 'b[a]ck', 'm[a]p'] },
    ],
    pairs: [
      {
        with: 'e',
        items: [
          ['bad', 'bed'],
          ['sat', 'set'],
          ['man', 'men'],
          ['land', 'lend'],
          ['had', 'head'],
        ],
      },
      {
        with: 'uh',
        items: [
          ['cap', 'cup'],
          ['cat', 'cut'],
          ['bag', 'bug'],
          ['fan', 'fun'],
        ],
      },
    ],
    phrases: ['The black cat sat on a mat.', 'Pack an apple in the bag.'],
    video: 'qVhaIHk88a8',
  },
  uh: {
    traits: ['Nguyên âm ngắn', 'Miệng thả lỏng'],
    steps: [
      'Miệng mở vừa, môi thả lỏng tự nhiên.',
      'Lưỡi nằm ở giữa khoang miệng, không cao không thấp.',
      'Phát âm ngắn như "ă" trong "ăn".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "a" dài (cup → "cáp") hoặc "ơ".',
        fix: 'Âm rất ngắn và gọn như "ă". "Cup" gần như "cắp".',
      },
    ],
    words: [
      { label: 'Viết u', items: ['c[u]p', 's[u]n', 'b[u]s', 'r[u]n'] },
      { label: 'Viết o', items: ['l[o]ve', 'c[o]me', 'm[o]ney', 's[o]n'] },
      {
        label: 'Viết khác',
        items: ['bl[oo]d', 'c[ou]ntry', 'y[ou]ng', 'en[ou]gh'],
      },
    ],
    pairs: [
      {
        with: 'ae',
        items: [
          ['cup', 'cap'],
          ['cut', 'cat'],
          ['bug', 'bag'],
          ['fun', 'fan'],
          ['much', 'match'],
        ],
      },
    ],
    phrases: ['My mother loves the sun.', 'Come up for lunch on Monday.'],
    video: 'PZwKFFp7V50',
  },
  'long-a': {
    traits: ['Nguyên âm dài', 'Miệng mở to'],
    steps: [
      'Mở miệng to như khi bác sĩ khám họng.',
      'Lưỡi hạ thấp và lùi về phía sau.',
      'Kéo dài âm "a".',
    ],
    mistakes: [
      {
        wrong: 'Đọc ngắn như "a" tiếng Việt, hoặc lẫn với /ʌ/ (heart → hut).',
        fix: 'Kéo dài gấp đôi, đặt lưỡi thấp và lùi về sau.',
      },
      {
        wrong: 'Giọng Mỹ: bỏ âm r trong "car", "start".',
        fix: 'Giọng Mỹ cong lưỡi lên ở cuối: /kɑːr/. Giọng Anh thì không đọc r.',
      },
    ],
    words: [
      { label: 'Viết ar', items: ['c[ar]', 'st[ar]t', 'p[ar]k', 'h[ar]d'] },
      { label: 'Viết a', items: ['f[a]ther', 'c[a]lm', 'p[a]lm', 'sp[a]'] },
      {
        label: 'Viết khác',
        items: ['h[ear]t', 'b[a]lm', 'dr[a]ma', 'p[a]sta'],
      },
    ],
    pairs: [
      {
        with: 'uh',
        items: [
          ['heart', 'hut'],
          ['cart', 'cut'],
          ['bark', 'buck'],
          ['march', 'much'],
        ],
      },
    ],
    phrases: ['Park the car in the yard.', 'My father is calm.'],
    video: 'uDHMuMQdBNw',
  },
  'short-o': {
    traits: ['Nguyên âm ngắn', 'Tròn môi', 'Chỉ giọng Anh'],
    steps: [
      'Mở miệng khá rộng, hàm dưới hạ xuống.',
      'Môi hơi tròn nhẹ.',
      'Lưỡi thấp và lùi về sau, phát âm ngắn như "o" trong "con".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "ô" tròn và căng.',
        fix: 'Miệng mở rộng hơn, môi chỉ hơi tròn. Âm ngắn và thả lỏng.',
      },
    ],
    words: [
      { label: 'Viết o', items: ['h[o]t', 'd[o]g', 'st[o]p', 'b[o]x'] },
      { label: 'Viết a', items: ['w[a]tch', 'w[a]nt', 'sw[a]n', 'qu[a]lity'] },
      { label: 'Đầu từ', items: ['[o]n', '[o]ff', '[o]ften', '[o]ffice'] },
    ],
    pairs: [
      {
        with: 'long-o',
        items: [
          ['cot', 'caught'],
          ['pot', 'port'],
          ['shot', 'short'],
          ['don', 'dawn'],
        ],
      },
    ],
    phrases: ['The dog got lost.', 'Stop the clock, Tom.'],
    video: 'MAk-XtHsyzM',
  },
  'long-o': {
    traits: ['Nguyên âm dài', 'Tròn môi'],
    steps: [
      'Chu môi tròn và đưa ra phía trước.',
      'Lưỡi lùi về sau, phần sau lưỡi hơi nâng.',
      'Kéo dài âm "o".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành nguyên âm đôi /oʊ/: "law" nghe như "low".',
        fix: 'Giữ môi cố định suốt âm, không trượt sang "u" ở cuối.',
      },
    ],
    words: [
      {
        label: 'Viết aw / au',
        items: ['l[aw]', 'dr[aw]', '[au]tumn', 's[au]ce'],
      },
      { label: 'Viết al', items: ['t[al]k', 'w[al]k', '[al]l', 'b[al]l'] },
      { label: 'Viết or', items: ['f[or]', 'sh[or]t', 'm[or]ning', 'd[oor]'] },
    ],
    pairs: [
      {
        with: 'ou',
        items: [
          ['law', 'low'],
          ['saw', 'so'],
          ['called', 'cold'],
          ['ball', 'bowl'],
        ],
      },
    ],
    phrases: ['I saw all four doors.', 'We talked in the morning.'],
    video: 'KHllC40_u1Q',
  },
  'short-u': {
    traits: ['Nguyên âm ngắn', 'Môi hơi tròn'],
    steps: [
      'Môi tròn nhẹ, thả lỏng, không chu ra nhiều.',
      'Phần sau lưỡi nâng lên nhưng thấp hơn /uː/.',
      'Phát âm ngắn và gọn.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "u" dài: "full" nghe như "fool", "look" như "Luke".',
        fix: 'Ngắn và lỏng như "ư" pha "u". Không chu môi căng.',
      },
    ],
    words: [
      { label: 'Viết oo', items: ['b[oo]k', 'g[oo]d', 'l[oo]k', 'f[oo]t'] },
      { label: 'Viết u', items: ['p[u]t', 'p[u]sh', 'f[u]ll', 'b[u]sh'] },
      {
        label: 'Viết ou',
        items: ['c[ou]ld', 'sh[ou]ld', 'w[ou]ld', 'w[o]man'],
      },
    ],
    pairs: [
      {
        with: 'long-u',
        items: [
          ['full', 'fool'],
          ['pull', 'pool'],
          ['look', 'Luke'],
          ['soot', 'suit'],
        ],
      },
    ],
    phrases: ['Look at this good book.', 'You should put it in.'],
    video: 'eJ7dM_LU9t4',
  },
  'long-u': {
    traits: ['Nguyên âm dài', 'Tròn môi'],
    steps: [
      'Chu môi tròn và nhỏ, đưa ra trước như khi huýt sáo.',
      'Phần sau lưỡi nâng cao.',
      'Kéo dài âm "u".',
    ],
    mistakes: [
      {
        wrong: 'Đọc ngắn: "pool" nghe như "pull".',
        fix: 'Chu môi rõ và kéo dài âm.',
      },
    ],
    words: [
      { label: 'Viết oo', items: ['f[oo]d', 'm[oo]n', 's[oo]n', 'sch[oo]l'] },
      { label: 'Viết u / ue', items: ['bl[ue]', 'tr[ue]', 'r[u]le', 'J[u]ne'] },
      {
        label: 'Viết khác',
        items: ['tw[o]', 'sh[oe]', 'fr[ui]t', 'thr[ough]'],
      },
    ],
    pairs: [
      {
        with: 'short-u',
        items: [
          ['fool', 'full'],
          ['pool', 'pull'],
          ['Luke', 'look'],
          ['suit', 'soot'],
        ],
      },
    ],
    phrases: ['Choose the blue shoes.', 'The school is too soon.'],
    video: 'mnKEGLuEzV4',
  },
  er: {
    traits: ['Nguyên âm dài', 'Miệng thả lỏng'],
    steps: [
      'Môi thả lỏng, hơi mở.',
      'Lưỡi ở giữa khoang miệng.',
      'Kéo dài âm "ơ".',
      'Giọng Mỹ: cong đầu lưỡi lên (không chạm vòm) để có màu "r".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "ơ" ngắn hoặc "ơ" + "r" rung kiểu tiếng Việt.',
        fix: 'Kéo dài "ơ". Giọng Mỹ chỉ cong lưỡi, không rung.',
      },
      {
        wrong: 'Nhầm với /ɑː/: "heard" nghe như "hard".',
        fix: 'Miệng mở ít hơn nhiều, lưỡi ở giữa chứ không thấp.',
      },
    ],
    words: [
      {
        label: 'Viết ir / ur',
        items: ['b[ir]d', 'f[ir]st', 'n[ur]se', 't[ur]n'],
      },
      {
        label: 'Viết er / ear',
        items: ['h[er]', 'p[er]son', 'l[ear]n', '[ear]ly'],
      },
      { label: 'Viết or', items: ['w[or]d', 'w[or]k', 'w[or]ld', 'w[or]se'] },
    ],
    pairs: [
      {
        with: 'uh',
        items: [
          ['hurt', 'hut'],
          ['turn', 'ton'],
          ['bird', 'bud'],
          ['shirt', 'shut'],
        ],
      },
    ],
    phrases: ['The girl learned her first word.', 'Nurses work early.'],
    video: 'zSJJWHymEPw',
  },
  schwa: {
    traits: ['Nguyên âm ngắn', 'Không bao giờ nhấn'],
    steps: [
      'Thả lỏng hoàn toàn môi, lưỡi và hàm.',
      'Phát ra một tiếng "ơ" rất nhẹ và ngắn, gần như nuốt.',
      'Chỉ xuất hiện ở âm tiết không nhấn: đọc nó yếu đi để âm tiết nhấn nổi bật.',
    ],
    mistakes: [
      {
        wrong: 'Đọc rõ mọi nguyên âm theo chữ viết: "banana" thành "ba-na-na".',
        fix: 'Chỉ nhấn một âm tiết, các âm còn lại đọc /ə/: /bəˈnɑːnə/.',
      },
      {
        wrong: 'Đọc "the, a, to, of" to và rõ như từ chính.',
        fix: 'Dạng yếu: "a cup of tea" → /ə ˈkʌp əv ˈtiː/.',
      },
    ],
    words: [
      {
        label: 'Âm tiết đầu',
        items: ['[a]bout', '[a]go', '[a]gain', 'p[o]lice'],
      },
      {
        label: 'Âm tiết giữa',
        items: ['fam[i]ly', 'choc[o]late', 'comf[or]table', 'meth[o]d'],
      },
      {
        label: 'Âm tiết cuối',
        items: ['sof[a]', 'Chin[a]', 'pand[a]', 'lem[o]n'],
      },
    ],
    pairs: [],
    phrases: ['A cup of tea, please.', 'I want to go to the station.'],
    video: 'wg0P0oYkniE',
  },

  // ───────── nguyên âm đôi ─────────
  ei: {
    traits: ['Nguyên âm đôi', 'Trượt e → i'],
    steps: [
      'Bắt đầu ở khẩu hình /e/, miệng mở vừa.',
      'Trượt nhẹ lưỡi và hàm lên vị trí /ɪ/.',
      'Phần đầu dài và rõ hơn phần cuối: "êêi".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "ê" đơn: "late" nghe như "let".',
        fix: 'Luôn trượt sang "i" ở cuối.',
      },
      {
        wrong: 'Bỏ phụ âm cuối: "make" thành "mây".',
        fix: 'Nói rõ /k/ ở cuối: /meɪk/.',
      },
    ],
    words: [
      { label: 'Viết a_e', items: ['m[a]ke', 'n[a]me', 'l[a]te', 'g[a]me'] },
      { label: 'Viết ai / ay', items: ['r[ai]n', 'w[ai]t', 'd[ay]', 'pl[ay]'] },
      {
        label: 'Viết khác',
        items: ['th[ey]', 'br[ea]k', '[eigh]t', 'gr[ea]t'],
      },
    ],
    pairs: [
      {
        with: 'e',
        items: [
          ['late', 'let'],
          ['wait', 'wet'],
          ['pain', 'pen'],
          ['sale', 'sell'],
          ['gate', 'get'],
        ],
      },
    ],
    phrases: ['Wait for the train today.', 'They came late again.'],
    video: '5FMPlqlFt9g',
  },
  ai: {
    traits: ['Nguyên âm đôi', 'Trượt a → i'],
    steps: [
      'Bắt đầu với miệng mở rộng như "a".',
      'Trượt hàm lên và kéo môi về vị trí /ɪ/.',
      'Giống "ai" tiếng Việt, phần "a" dài hơn.',
    ],
    mistakes: [
      {
        wrong: 'Bỏ phụ âm cuối: "time" thành "tai", "like" thành "lai".',
        fix: 'Âm đôi xong phải đóng bằng phụ âm cuối: /taɪm/, /laɪk/.',
      },
    ],
    words: [
      { label: 'Viết i_e', items: ['t[i]me', 'l[i]ke', 'n[i]ce', 'wr[i]te'] },
      { label: 'Viết y / igh', items: ['m[y]', 'fl[y]', 'h[igh]', 'n[igh]t'] },
      { label: 'Viết khác', items: ['b[uy]', '[eye]', 'p[ie]', 'k[i]nd'] },
    ],
    pairs: [
      {
        with: 'oi',
        items: [
          ['buy', 'boy'],
          ['tie', 'toy'],
          ['file', 'foil'],
          ['aisle', 'oil'],
        ],
      },
    ],
    phrases: ['I like to fly at night.', 'Write it five times.'],
    video: 'Hb8COxAtl14',
  },
  oi: {
    traits: ['Nguyên âm đôi', 'Trượt ɔ → i'],
    steps: [
      'Bắt đầu tròn môi như /ɔː/.',
      'Trượt nhanh sang /ɪ/, môi bè ra.',
      'Giống "oi" tiếng Việt.',
    ],
    mistakes: [
      {
        wrong: 'Bỏ phụ âm cuối: "noise" thành "noi", "coin" thành "coi".',
        fix: 'Đóng âm bằng phụ âm cuối: /nɔɪz/, /kɔɪn/.',
      },
    ],
    words: [
      { label: 'Viết oy', items: ['b[oy]', 't[oy]', 'enj[oy]', 'empl[oy]'] },
      { label: 'Viết oi', items: ['c[oi]n', 'v[oi]ce', 'ch[oi]ce', 'p[oi]nt'] },
      { label: 'Giữa từ', items: ['n[oi]se', 'b[oi]l', 'j[oi]n', 'av[oi]d'] },
    ],
    pairs: [
      {
        with: 'ai',
        items: [
          ['boy', 'buy'],
          ['toy', 'tie'],
          ['foil', 'file'],
          ['oil', 'aisle'],
        ],
      },
    ],
    phrases: ['The boy enjoys his toy.', 'Avoid noise, use your voice.'],
    video: 'lFRrEI85IcM',
  },
  au: {
    traits: ['Nguyên âm đôi', 'Trượt a → u'],
    steps: [
      'Bắt đầu mở miệng rộng như "a".',
      'Trượt sang /ʊ/, môi tròn dần lại.',
      'Giống "ao" tiếng Việt.',
    ],
    mistakes: [
      {
        wrong: 'Nhầm với /oʊ/: "now" nghe như "know", "town" như "tone".',
        fix: 'Bắt đầu bằng "a" mở rộng, không phải "ô".',
      },
    ],
    words: [
      { label: 'Viết ow', items: ['n[ow]', 'h[ow]', 't[ow]n', 'br[ow]n'] },
      { label: 'Viết ou', items: ['h[ou]se', '[ou]t', 'l[ou]d', 'f[ou]nd'] },
      { label: 'Cuối từ', items: ['c[ow]', 'all[ow]', 'w[ow]', 'pl[ough]'] },
    ],
    pairs: [
      {
        with: 'ou',
        items: [
          ['now', 'know'],
          ['town', 'tone'],
          ['couch', 'coach'],
          ['loud', 'load'],
        ],
      },
    ],
    phrases: ['How now, brown cow?', 'Shout it out loud.'],
    video: '9WDnVMQIaTs',
  },
  ou: {
    traits: ['Nguyên âm đôi', 'Tròn môi'],
    steps: [
      'Giọng Mỹ /oʊ/: bắt đầu tròn môi như "ô", trượt sang "u".',
      'Giọng Anh /əʊ/: bắt đầu môi thả lỏng như "ơ", rồi tròn môi sang "u".',
      'Môi phải chuyển động rõ trong lúc phát âm.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "ô" đơn: "go" thành "gô", "home" thành "hôm".',
        fix: 'Luôn kết thúc bằng môi tròn nhỏ "u": "gâu" (Anh) / "gôu" (Mỹ).',
      },
    ],
    words: [
      { label: 'Viết o_e', items: ['h[o]me', 'n[o]se', 'ph[o]ne', 'h[o]pe'] },
      {
        label: 'Viết ow / oa',
        items: ['kn[ow]', 'sh[ow]', 'b[oa]t', 'r[oa]d'],
      },
      { label: 'Viết o', items: ['g[o]', 'n[o]', 's[o]', '[o]pen'] },
    ],
    pairs: [
      {
        with: 'long-o',
        items: [
          ['low', 'law'],
          ['so', 'saw'],
          ['cold', 'called'],
          ['bowl', 'ball'],
        ],
      },
    ],
    phrases: ['Go home and phone Joe.', 'I know the road.'],
    video: 'r1BRCG0P9C8',
  },
  ia: {
    traits: ['Nguyên âm đôi', 'Chỉ giọng Anh'],
    steps: [
      'Bắt đầu ở /ɪ/, môi hơi bè.',
      'Trượt về "ơ" nhẹ ở giữa miệng.',
      'Giống "ia" trong "bia". Giọng Mỹ đọc là /ɪr/.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "i" đơn hoặc thêm "r" rung.',
        fix: 'Trượt rõ sang "ơ". Giọng Anh không đọc r.',
      },
    ],
    words: [
      { label: 'Viết ear', items: ['n[ear]', 'h[ear]', 'cl[ear]', 'y[ear]'] },
      {
        label: 'Viết eer / ere',
        items: ['b[eer]', 'ch[eer]', 'h[ere]', 'm[ere]'],
      },
      { label: 'Viết khác', items: ['f[ear]', 'w[eir]d', 'p[ier]', 'b[ear]d'] },
    ],
    pairs: [
      {
        with: 'ea',
        items: [
          ['beer', 'bear'],
          ['here', 'hair'],
          ['cheer', 'chair'],
          ['fear', 'fair'],
        ],
      },
    ],
    phrases: ['Come near here, dear.', 'It is clear this year.'],
    video: 'vC0h4S0YPJc',
  },
  ea: {
    traits: ['Nguyên âm đôi', 'Chỉ giọng Anh'],
    steps: [
      'Bắt đầu ở /e/, miệng mở vừa.',
      'Trượt về "ơ" nhẹ.',
      'Nghe như "e-ơ". Giọng Mỹ đọc là /er/.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "e" đơn hoặc "ia".',
        fix: 'Bắt đầu bằng "e" mở, kết thúc "ơ". "Hair" khác hẳn "here".',
      },
    ],
    words: [
      { label: 'Viết air', items: ['h[air]', 'ch[air]', 'f[air]', 'p[air]'] },
      {
        label: 'Viết are',
        items: ['c[are]', 'sh[are]', 'sc[are]', 'squ[are]'],
      },
      {
        label: 'Viết khác',
        items: ['wh[ere]', 'th[ere]', 'b[ear]', 'th[eir]'],
      },
    ],
    pairs: [
      {
        with: 'ia',
        items: [
          ['bear', 'beer'],
          ['hair', 'here'],
          ['chair', 'cheer'],
          ['fair', 'fear'],
        ],
      },
    ],
    phrases: ['Where is their chair?', 'Take care of your hair.'],
    video: '0J7-5maJJIk',
  },
  ua: {
    traits: ['Nguyên âm đôi', 'Chỉ giọng Anh', 'Đang hiếm dần'],
    steps: [
      'Bắt đầu ở /ʊ/, môi hơi tròn.',
      'Trượt về "ơ" nhẹ, môi thả lỏng.',
      'Nhiều người Anh trẻ đọc luôn thành /ɔː/: "sure" = "shore".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "u" đơn: "tour" thành "tu".',
        fix: 'Trượt sang "ơ" ở cuối, hoặc dùng /ɔː/ như người Anh trẻ.',
      },
    ],
    words: [
      {
        label: 'Viết our / oor',
        items: ['t[our]', 'p[oor]', 'm[oor]', 'b[oor]'],
      },
      { label: 'Viết ure', items: ['s[ure]', 'c[ure]', 'p[ure]', 'end[ure]'] },
      {
        label: 'Cuối từ -ure',
        items: ['mat[ure]', 'obsc[ure]', 'sec[ure]', 'ins[ure]'],
      },
    ],
    pairs: [
      {
        with: 'long-o',
        items: [
          ['sure', 'shore'],
          ['poor', 'paw'],
          ['tour', 'tore'],
        ],
      },
    ],
    phrases: ['Are you sure?', 'The tourist is poor.'],
    video: 'nHSqluHrD-U',
  },

  // ───────── phụ âm ─────────
  p: {
    traits: ['Không rung', 'Bật hơi', 'Hai môi'],
    steps: [
      'Mím hai môi lại, giữ hơi phía sau.',
      'Bật môi ra thật mạnh, cho hơi thoát ra.',
      'Dây thanh không rung. Đầu từ phải có luồng hơi rõ: đặt tờ giấy trước miệng sẽ thấy giấy lay động.',
    ],
    mistakes: [
      {
        wrong: 'Không bật hơi nên "pin" nghe như "bin".',
        fix: 'Đọc như "ph" tiếng Việt nhưng hai môi mím: "p-hin".',
      },
      {
        wrong: 'Bỏ âm cuối: "stop" thành "sto", "cup" thành "cắ".',
        fix: 'Mím môi lại ở cuối và bật nhẹ.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[p]en', '[p]ark', '[p]ay', '[p]eople'] },
      { label: 'Giữa từ', items: ['ha[pp]y', 'pa[p]er', 'o[p]en', 'sim[p]le'] },
      { label: 'Cuối từ', items: ['sto[p]', 'cu[p]', 'ma[p]', 'kee[p]'] },
    ],
    pairs: [
      {
        with: 'b',
        items: [
          ['pea', 'bee'],
          ['pack', 'back'],
          ['pin', 'bin'],
          ['cap', 'cab'],
          ['rope', 'robe'],
        ],
      },
    ],
    phrases: ['Put the paper in the cup.', 'Peter keeps a pet pig.'],
    video: 'AZRREr7DqqM',
  },
  b: {
    traits: ['Rung', 'Hai môi'],
    steps: [
      'Mím hai môi lại.',
      'Rung dây thanh (đặt tay lên cổ sẽ thấy rung) rồi mở môi.',
      'Không bật hơi mạnh như /p/.',
    ],
    mistakes: [
      {
        wrong: 'Bỏ âm cuối hoặc đọc thành /p/: "cab" thành "cap".',
        fix: 'Giữ rung cổ họng đến hết từ, mím môi ở cuối.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[b]ad', '[b]ig', '[b]ook', '[b]lue'] },
      {
        label: 'Giữa từ',
        items: ['ra[bb]it', 'ha[b]it', 'ta[b]le', 'num[b]er'],
      },
      { label: 'Cuối từ', items: ['jo[b]', 'ca[b]', 'we[b]', 'clu[b]'] },
    ],
    pairs: [
      {
        with: 'p',
        items: [
          ['bee', 'pea'],
          ['back', 'pack'],
          ['bin', 'pin'],
          ['cab', 'cap'],
          ['robe', 'rope'],
        ],
      },
    ],
    phrases: ['Bob bought a big blue bag.', 'The baby is in the cab.'],
    video: 'yP7aCKO6bTE',
  },
  t: {
    traits: ['Không rung', 'Bật hơi', 'Đầu lưỡi – lợi'],
    steps: [
      'Đặt đầu lưỡi lên lợi ngay sau răng cửa trên (không phải chạm răng như "t" tiếng Việt).',
      'Giữ hơi rồi hạ lưỡi xuống, bật hơi mạnh.',
      'Giọng Mỹ: giữa hai nguyên âm (water, better) đọc nhanh như "đ" nhẹ.',
    ],
    mistakes: [
      {
        wrong: 'Đọc như "t" tiếng Việt (không bật hơi) nên nghe như /d/.',
        fix: 'Bật hơi như "th" tiếng Việt nhưng lưỡi đặt ở lợi.',
      },
      {
        wrong: 'Bỏ âm cuối và đuôi -ed: "worked" thành "wớc".',
        fix: 'Chạm lưỡi lên lợi ở cuối từ: /wɜːkt/.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[t]ea', '[t]ime', '[t]en', '[t]alk'] },
      {
        label: 'Giữa từ',
        items: ['wa[t]er', 'be[tt]er', 'le[tt]er', 'ci[t]y'],
      },
      { label: 'Cuối từ', items: ['ca[t]', 'ge[t]', 'wan[t]', 'las[t]'] },
    ],
    pairs: [
      {
        with: 'd',
        items: [
          ['tie', 'die'],
          ['ten', 'den'],
          ['bat', 'bad'],
          ['write', 'ride'],
          ['cart', 'card'],
        ],
      },
    ],
    phrases: ['Tell Tom to wait.', 'I want to eat at ten.'],
    video: '0T1QYByMxrs',
  },
  d: {
    traits: ['Rung', 'Đầu lưỡi – lợi'],
    steps: [
      'Đặt đầu lưỡi lên lợi sau răng cửa trên.',
      'Rung dây thanh rồi hạ lưỡi xuống.',
      'Không giống "đ" tiếng Việt: lưỡi chạm lợi chứ không chạm răng.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "đ" tiếng Việt.',
        fix: 'Đưa lưỡi lùi lên lợi. Âm gọn và nhẹ hơn "đ".',
      },
      {
        wrong: 'Bỏ âm cuối: "good" thành "gu", "played" thành "plây".',
        fix: 'Chạm lưỡi lên lợi và giữ rung ở cuối từ.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[d]og', '[d]ay', '[d]oor', '[d]rink'] },
      {
        label: 'Giữa từ',
        items: ['la[dd]er', 'rea[d]y', 'mi[dd]le', 'Fri[d]ay'],
      },
      { label: 'Cuối từ', items: ['goo[d]', 'ba[d]', 're[d]', 'col[d]'] },
    ],
    pairs: [
      {
        with: 't',
        items: [
          ['die', 'tie'],
          ['den', 'ten'],
          ['bad', 'bat'],
          ['ride', 'write'],
          ['card', 'cart'],
        ],
      },
    ],
    phrases: ['David played a good game.', 'Do it today, Dad.'],
    video: 'qA5ZYC89oso',
  },
  k: {
    traits: ['Không rung', 'Bật hơi', 'Gốc lưỡi'],
    steps: [
      'Nâng phần sau lưỡi chạm vòm mềm (phía sau vòm miệng).',
      'Giữ hơi rồi hạ lưỡi, bật hơi mạnh.',
      'Đầu từ nghe như "kh" nhẹ.',
    ],
    mistakes: [
      {
        wrong: 'Bỏ âm cuối: "back" thành "be", "like" thành "lai".',
        fix: 'Chặn hơi bằng gốc lưỡi ở cuối từ, có thể bật rất nhẹ.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[c]at', '[k]ey', '[c]ome', '[qu]een'] },
      {
        label: 'Giữa từ',
        items: ['ba[k]er', 'ta[k]en', 'lu[ck]y', 'po[ck]et'],
      },
      { label: 'Cuối từ', items: ['ba[ck]', 'boo[k]', 'li[k]e', 'cli[ck]'] },
    ],
    pairs: [
      {
        with: 'g',
        items: [
          ['coat', 'goat'],
          ['cap', 'gap'],
          ['back', 'bag'],
          ['pick', 'pig'],
        ],
      },
    ],
    phrases: ['Kate keeps a cake in the kitchen.', 'Can I come back?'],
    video: 'd1jyIpAmLe8',
  },
  g: {
    traits: ['Rung', 'Gốc lưỡi'],
    steps: [
      'Nâng phần sau lưỡi chạm vòm mềm.',
      'Rung dây thanh rồi hạ lưỡi.',
      'Không bật hơi mạnh như /k/.',
    ],
    mistakes: [
      {
        wrong: 'Bỏ âm cuối hoặc đọc thành /k/: "bag" thành "back".',
        fix: 'Giữ rung cổ họng đến hết âm.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[g]o', '[g]ame', '[g]ood', '[g]reen'] },
      {
        label: 'Giữa từ',
        items: ['a[g]ain', 'bi[gg]er', 'su[g]ar', 'ti[g]er'],
      },
      { label: 'Cuối từ', items: ['bi[g]', 'do[g]', 'e[gg]', 'ba[g]'] },
    ],
    pairs: [
      {
        with: 'k',
        items: [
          ['goat', 'coat'],
          ['gap', 'cap'],
          ['bag', 'back'],
          ['pig', 'pick'],
        ],
      },
    ],
    phrases: ['Give the dog a big egg.', 'Go and get the green bag.'],
    video: '9eAqj9EfeK0',
  },
  f: {
    traits: ['Không rung', 'Môi – răng'],
    steps: [
      'Đặt răng cửa trên chạm nhẹ môi dưới.',
      'Thổi hơi qua khe giữa răng và môi.',
      'Dây thanh không rung.',
    ],
    mistakes: [
      {
        wrong: 'Bỏ âm cuối: "life" thành "lai", "laugh" thành "la".',
        fix: 'Giữ răng chạm môi và thổi hơi đến hết từ.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[f]ish', '[f]ive', '[ph]one', '[f]ood'] },
      {
        label: 'Giữa từ',
        items: ['co[ff]ee', 'o[ff]ice', 'be[f]ore', 'a[f]ter'],
      },
      { label: 'Cuối từ', items: ['li[f]e', 'hal[f]', 'enou[gh]', 'lea[f]'] },
    ],
    pairs: [
      {
        with: 'v',
        items: [
          ['fan', 'van'],
          ['fine', 'vine'],
          ['safe', 'save'],
          ['leaf', 'leave'],
          ['few', 'view'],
        ],
      },
    ],
    phrases: ['Five fat fish.', 'I feel fine after coffee.'],
    video: 'vE12RFyH-hY',
  },
  v: {
    traits: ['Rung', 'Môi – răng'],
    steps: [
      'Đặt răng cửa trên chạm nhẹ môi dưới như /f/.',
      'Rung dây thanh trong lúc thổi hơi: môi dưới hơi tê.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành /w/ (tròn môi): "very" nghe như "wary".',
        fix: 'Răng phải chạm môi dưới, không chu môi.',
      },
      {
        wrong: 'Bỏ âm cuối hoặc đọc thành /f/: "have", "love", "five".',
        fix: 'Giữ rung đến hết từ.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[v]an', '[v]ery', '[v]oice', '[v]isit'] },
      { label: 'Giữa từ', items: ['ne[v]er', 'e[v]ery', 'ri[v]er', 'mo[v]ie'] },
      { label: 'Cuối từ', items: ['lo[v]e', 'fi[v]e', 'ha[v]e', 'gi[v]e'] },
    ],
    pairs: [
      {
        with: 'f',
        items: [
          ['van', 'fan'],
          ['vine', 'fine'],
          ['save', 'safe'],
          ['leave', 'leaf'],
        ],
      },
      {
        with: 'w',
        items: [
          ['vest', 'west'],
          ['vine', 'wine'],
          ['vet', 'wet'],
          ['very', 'wary'],
        ],
      },
    ],
    phrases: ['I love five violins.', 'Vicky never visits.'],
    video: 'mO04G0v5a_c',
  },
  th: {
    traits: ['Không rung', 'Lưỡi – răng', 'Không có trong tiếng Việt'],
    steps: [
      'Đặt đầu lưỡi giữa hai hàm răng, thò ra một chút.',
      'Thổi hơi qua khe giữa lưỡi và răng trên.',
      'Dây thanh không rung. Âm này "xì" nhẹ như rắn có lưỡi chạm răng.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "th" tiếng Việt hoặc /t/: "three" nghe như "tree".',
        fix: 'Lưỡi phải thò ra giữa răng, hơi đi liên tục chứ không bật.',
      },
      {
        wrong: 'Đọc thành /s/: "think" nghe như "sink".',
        fix: 'Soi gương: phải thấy đầu lưỡi giữa hai hàm răng.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[th]ink', '[th]ree', '[th]ank', '[th]ing'] },
      {
        label: 'Giữa từ',
        items: ['no[th]ing', 'bir[th]day', 'heal[th]y', 'any[th]ing'],
      },
      { label: 'Cuối từ', items: ['ba[th]', 'mon[th]', 'mou[th]', 'heal[th]'] },
    ],
    pairs: [
      {
        with: 's',
        items: [
          ['think', 'sink'],
          ['thick', 'sick'],
          ['mouth', 'mouse'],
          ['thing', 'sing'],
          ['path', 'pass'],
        ],
      },
      {
        with: 't',
        items: [
          ['three', 'tree'],
          ['thank', 'tank'],
          ['thin', 'tin'],
          ['both', 'boat'],
        ],
      },
    ],
    phrases: ['Thank you for three things.', 'I think it is Thursday.'],
    video: 'b4Aj3k65HSo',
  },
  dh: {
    traits: ['Rung', 'Lưỡi – răng', 'Không có trong tiếng Việt'],
    steps: [
      'Đặt đầu lưỡi giữa hai hàm răng như /θ/.',
      'Rung dây thanh trong lúc đẩy hơi: đầu lưỡi hơi tê.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "đ" hoặc /d/: "they" nghe như "day".',
        fix: 'Thò lưỡi ra giữa răng, hơi đi liên tục.',
      },
      {
        wrong: 'Đọc thành /z/: "this" thành "zis".',
        fix: 'Lưỡi chạm răng, không để sau răng như /z/.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[th]is', '[th]at', '[th]ey', '[th]ere'] },
      {
        label: 'Giữa từ',
        items: ['mo[th]er', 'fa[th]er', 'o[th]er', 'toge[th]er'],
      },
      {
        label: 'Cuối từ',
        items: ['wi[th]', 'brea[th]e', 'smoo[th]', 'ba[th]e'],
      },
    ],
    pairs: [
      {
        with: 'd',
        items: [
          ['they', 'day'],
          ['then', 'den'],
          ['though', 'dough'],
          ['breathe', 'breed'],
        ],
      },
      {
        with: 'z',
        items: [
          ['breathe', 'breeze'],
          ['teethe', 'tease'],
          ['then', 'zen'],
        ],
      },
    ],
    phrases: ['This is my mother.', 'They went there together.'],
    video: 'tu1t3Fn5Lw8',
  },
  s: {
    traits: ['Không rung', 'Đầu lưỡi – lợi'],
    steps: [
      'Đầu lưỡi gần lợi trên, không chạm, để một khe hẹp.',
      'Răng gần khép, đẩy hơi qua khe tạo tiếng xì.',
      'Dây thanh không rung.',
    ],
    mistakes: [
      {
        wrong:
          'Bỏ /s/ cuối (số nhiều, ngôi thứ ba, sở hữu): "he likes" thành "he like".',
        fix: 'Luôn xì nhẹ ở cuối: "books", "cats", "it\'s".',
      },
      {
        wrong: 'Đọc thành /ʃ/ (môi chu): "see" thành "she".',
        fix: 'Môi bè, không chu ra.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[s]ee', '[s]un', '[c]ity', '[s]tudent'] },
      {
        label: 'Giữa từ',
        items: ['ba[s]ket', 'le[ss]on', 'mi[ss]ing', 'ba[s]ic'],
      },
      { label: 'Cuối từ', items: ['bu[s]', 'ki[ss]', 'ni[c]e', 'book[s]'] },
    ],
    pairs: [
      {
        with: 'z',
        items: [
          ['sip', 'zip'],
          ['bus', 'buzz'],
          ['price', 'prize'],
          ['rice', 'rise'],
        ],
      },
      {
        with: 'sh',
        items: [
          ['see', 'she'],
          ['sip', 'ship'],
          ['save', 'shave'],
          ['mass', 'mash'],
        ],
      },
    ],
    phrases: ['She sells sea shells.', 'Sam sits on the bus.'],
    video: 'QtH3vRXmvvo',
  },
  z: {
    traits: ['Rung', 'Đầu lưỡi – lợi'],
    steps: ['Đặt lưỡi giống /s/.', 'Rung dây thanh: nghe như tiếng ong "zzz".'],
    mistakes: [
      {
        wrong: 'Đọc thành /s/: "rise" nghe như "rice", "dogs" như "docks".',
        fix: 'Giữ rung cổ họng. Đuôi -s sau âm rung đọc /z/: dogs, plays, loves.',
      },
      {
        wrong: 'Đọc thành "d" hoặc "gi" tiếng Việt.',
        fix: 'Hơi đi liên tục qua khe, lưỡi không chạm lợi.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[z]oo', '[z]ero', '[z]one', '[z]ip'] },
      { label: 'Giữa từ', items: ['bu[s]y', 'ea[s]y', 'mu[s]ic', 'la[z]y'] },
      { label: 'Cuối từ', items: ['ro[s]e', 'do[g]s', 'i[s]', 'ha[s]'] },
    ],
    pairs: [
      {
        with: 's',
        items: [
          ['zip', 'sip'],
          ['buzz', 'bus'],
          ['prize', 'price'],
          ['rise', 'rice'],
        ],
      },
    ],
    phrases: ['Zoe is busy at the zoo.', 'His dogs love music.'],
    video: 'o1ZvmX80t7Q',
  },
  sh: {
    traits: ['Không rung', 'Tròn môi'],
    steps: [
      'Chu môi tròn và đưa ra trước.',
      'Lưỡi lùi hơn /s/, nâng gần vòm miệng.',
      'Đẩy hơi như khi bảo người khác im lặng "shh".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành /s/: "she" nghe như "see", "ship" như "sip".',
        fix: 'Chu môi ra rõ, tiếng hơi "dày" và trầm hơn /s/.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[sh]e', '[sh]ip', '[sh]op', '[s]ure'] },
      {
        label: 'Giữa từ',
        items: ['na[ti]on', 'o[c]ean', 'spe[ci]al', 'wa[sh]ing'],
      },
      { label: 'Cuối từ', items: ['wi[sh]', 'fi[sh]', 'ca[sh]', 'pu[sh]'] },
    ],
    pairs: [
      {
        with: 's',
        items: [
          ['she', 'see'],
          ['ship', 'sip'],
          ['shave', 'save'],
          ['mash', 'mass'],
        ],
      },
      {
        with: 'ch',
        items: [
          ['share', 'chair'],
          ['sheep', 'cheap'],
          ['wash', 'watch'],
          ['shin', 'chin'],
        ],
      },
    ],
    phrases: ['She should wash the dishes.', 'I wish for fresh fish.'],
    video: 'NF92RdZC6wE',
  },
  zh: {
    traits: ['Rung', 'Tròn môi', 'Hiếm ở đầu từ'],
    steps: [
      'Đặt miệng giống /ʃ/: môi chu, lưỡi nâng gần vòm.',
      'Rung dây thanh trong lúc đẩy hơi.',
      'Hầu như chỉ gặp ở giữa từ: vision, usual, measure.',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành /z/ hoặc "gi" tiếng Việt: "vision" thành "vi-giần".',
        fix: 'Chu môi như /ʃ/ và thêm rung.',
      },
    ],
    words: [
      {
        label: 'Viết -sion',
        items: ['vi[s]ion', 'deci[s]ion', 'televi[s]ion', 'ver[s]ion'],
      },
      {
        label: 'Viết -sure / -sual',
        items: ['mea[s]ure', 'plea[s]ure', 'u[s]ual', 'trea[s]ure'],
      },
      {
        label: 'Cuối từ',
        items: ['gara[g]e', 'mira[g]e', 'bei[g]e', 'massa[g]e'],
      },
    ],
    pairs: [],
    phrases: ['It is usually a pleasure.', 'Measure the garage.'],
    video: 'bTxeAiBF61I',
  },
  h: {
    traits: ['Không rung', 'Chỉ có hơi'],
    steps: [
      'Mở miệng sẵn theo nguyên âm phía sau.',
      'Thở hắt ra nhẹ từ cổ họng, như hà hơi lên kính.',
      'Không ma sát, không khàn như "h" tiếng Việt.',
    ],
    mistakes: [
      {
        wrong: 'Bỏ /h/: "hair" nghe như "air", "heat" như "eat".',
        fix: 'Luôn có một luồng hơi nhẹ trước nguyên âm.',
      },
      {
        wrong: 'Đọc /h/ trong từ câm: hour, honest.',
        fix: 'Các từ này bắt đầu bằng nguyên âm: /aʊə/, /ˈɒnɪst/.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[h]at', '[h]ouse', '[h]appy', '[wh]o'] },
      {
        label: 'Giữa từ',
        items: ['be[h]ind', 'a[h]ead', 'per[h]aps', 'un[h]appy'],
      },
      { label: 'Viết wh', items: ['[wh]ole', '[wh]om', '[wh]ose', '[h]elp'] },
    ],
    pairs: [
      {
        with: 'không có /h/',
        items: [
          ['hat', 'at'],
          ['heat', 'eat'],
          ['hear', 'ear'],
          ['hair', 'air'],
        ],
      },
    ],
    phrases: ['How are you, Harry?', 'He has a happy home.'],
    video: 'DM_gN6imoC8',
  },
  ch: {
    traits: ['Không rung', 'Tròn môi', 'Bật rồi xì'],
    steps: [
      'Đặt đầu lưỡi lên lợi trên như /t/, môi chu ra.',
      'Bật lưỡi ra và chuyển ngay sang /ʃ/: "t" + "sh".',
      'Dây thanh không rung.',
    ],
    mistakes: [
      {
        wrong: 'Đọc như "ch" tiếng Việt (mặt lưỡi chạm vòm, không chu môi).',
        fix: 'Chu môi tròn và bật mạnh: "tsh".',
      },
      {
        wrong: 'Bỏ âm cuối: "watch" thành "wo", "teach" thành "ti".',
        fix: 'Kết thúc bằng tiếng "tsh" rõ ràng.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[ch]air', '[ch]eap', '[ch]ild', '[ch]oose'] },
      {
        label: 'Giữa từ',
        items: ['tea[ch]er', 'kit[ch]en', 'na[t]ure', 'pic[t]ure'],
      },
      { label: 'Cuối từ', items: ['wa[tch]', 'mu[ch]', 'lun[ch]', 'bea[ch]'] },
    ],
    pairs: [
      {
        with: 'sh',
        items: [
          ['chair', 'share'],
          ['cheap', 'sheep'],
          ['watch', 'wash'],
          ['chin', 'shin'],
        ],
      },
      {
        with: 'j',
        items: [
          ['cheap', 'jeep'],
          ['chain', 'Jane'],
          ['rich', 'ridge'],
          ['choke', 'joke'],
        ],
      },
    ],
    phrases: ['Choose a cheap chair.', 'Watch the children at lunch.'],
    video: 'PykxZ5kkrjs',
  },
  j: {
    traits: ['Rung', 'Tròn môi', 'Bật rồi xì'],
    steps: [
      'Đặt miệng giống /tʃ/: lưỡi chạm lợi, môi chu.',
      'Rung dây thanh khi bật lưỡi: "d" + "ʒ".',
    ],
    mistakes: [
      {
        wrong: 'Đọc như "gi" hay "d" tiếng Việt: "job" thành "giốp".',
        fix: 'Chu môi và bật lưỡi từ lợi, có rung.',
      },
      {
        wrong: 'Bỏ âm cuối: "age" thành "ây", "bridge" thành "bri".',
        fix: 'Kết thúc bằng tiếng "dzh" rõ ràng.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[j]ob', '[j]uice', '[g]ym', '[j]oke'] },
      {
        label: 'Giữa từ',
        items: ['ma[j]or', 'pa[g]es', 'en[j]oy', 'sol[d]ier'],
      },
      { label: 'Cuối từ', items: ['a[g]e', 'bri[dg]e', 'pa[g]e', 'lar[g]e'] },
    ],
    pairs: [
      {
        with: 'ch',
        items: [
          ['jeep', 'cheap'],
          ['Jane', 'chain'],
          ['ridge', 'rich'],
          ['joke', 'choke'],
        ],
      },
    ],
    phrases: ['John enjoys orange juice.', 'Jump over the bridge.'],
    video: '0IeQmGdo7gQ',
  },
  m: {
    traits: ['Rung', 'Âm mũi', 'Hai môi'],
    steps: [
      'Mím hai môi lại.',
      'Cho hơi đi qua mũi, dây thanh rung.',
      'Giống "m" tiếng Việt.',
    ],
    mistakes: [
      {
        wrong: 'Cuối từ đọc lẫn sang /n/ hoặc bỏ: "team" nghe như "teen".',
        fix: 'Mím môi chặt ở cuối từ và ngân một chút.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[m]an', '[m]ake', '[m]oney', '[m]usic'] },
      {
        label: 'Giữa từ',
        items: ['su[mm]er', 'ha[mm]er', 'le[m]on', 'nu[m]ber'],
      },
      { label: 'Cuối từ', items: ['ti[m]e', 'ho[m]e', 'roo[m]', 'drea[m]'] },
    ],
    pairs: [
      {
        with: 'n',
        items: [
          ['team', 'teen'],
          ['some', 'sun'],
          ['mail', 'nail'],
          ['rum', 'run'],
        ],
      },
    ],
    phrases: ['My mum makes jam.', 'Come home in the morning.'],
    video: '0Te4Us8Tsv8',
  },
  n: {
    traits: ['Rung', 'Âm mũi', 'Đầu lưỡi – lợi'],
    steps: [
      'Đặt đầu lưỡi lên lợi sau răng cửa trên.',
      'Cho hơi đi qua mũi, dây thanh rung.',
    ],
    mistakes: [
      {
        wrong: 'Lẫn /n/ và /l/ (người miền Bắc): "night" nghe như "light".',
        fix: '/n/ hơi ra đằng mũi (bịt mũi sẽ không nói được), /l/ hơi ra hai bên lưỡi.',
      },
      {
        wrong: 'Cuối từ đọc thành "ng": "thin" nghe như "thing".',
        fix: 'Kết thúc bằng đầu lưỡi chạm lợi, không phải gốc lưỡi.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[n]o', '[n]ight', '[n]ame', '[kn]ow'] },
      {
        label: 'Giữa từ',
        items: ['su[nn]y', 'mo[n]ey', 'di[nn]er', 'fi[n]ish'],
      },
      { label: 'Cuối từ', items: ['te[n]', 'su[n]', 'rai[n]', 'tow[n]'] },
    ],
    pairs: [
      {
        with: 'l',
        items: [
          ['night', 'light'],
          ['know', 'low'],
          ['need', 'lead'],
          ['snow', 'slow'],
        ],
      },
      {
        with: 'ng',
        items: [
          ['thin', 'thing'],
          ['ban', 'bang'],
          ['sin', 'sing'],
          ['ran', 'rang'],
        ],
      },
    ],
    phrases: ['Nine nice nights.', 'No one knew his name.'],
    video: 'qkgucMjv4T0',
  },
  ng: {
    traits: ['Rung', 'Âm mũi', 'Gốc lưỡi'],
    steps: [
      'Nâng phần sau lưỡi chạm vòm mềm như /k/.',
      'Cho hơi đi qua mũi.',
      'Giống "ng" tiếng Việt, nhưng không thêm /g/ phía sau (sing ≠ "sin-g").',
    ],
    mistakes: [
      {
        wrong: 'Đuôi -ing đọc thành "inh".',
        fix: 'Nguyên âm /ɪ/ ngắn rồi "ng": "sing" = "xíng" chứ không phải "xinh".',
      },
      {
        wrong: 'Đọc thành /n/: "thing" nghe như "thin".',
        fix: 'Kết thúc bằng gốc lưỡi, đầu lưỡi để yên.',
      },
    ],
    words: [
      { label: 'Viết ng', items: ['si[ng]', 'lo[ng]', 'you[ng]', 'ri[ng]'] },
      {
        label: 'Viết -ing',
        items: ['go[ing]', 'mor[n]ing', 'thi[ng]', 'spri[ng]'],
      },
      {
        label: 'Trước k / g',
        items: ['thi[n]k', 'ba[n]k', 'fi[n]ger', 'E[n]glish'],
      },
    ],
    pairs: [
      {
        with: 'n',
        items: [
          ['thing', 'thin'],
          ['sing', 'sin'],
          ['bang', 'ban'],
          ['rang', 'ran'],
        ],
      },
    ],
    phrases: ['The king is singing.', 'I am going to bring the ring.'],
    video: 'rgWse3tloTw',
  },
  l: {
    traits: ['Rung', 'Hơi ra hai bên lưỡi'],
    steps: [
      'Đặt đầu lưỡi lên lợi sau răng cửa trên.',
      'Cho hơi thoát ra hai bên lưỡi, dây thanh rung.',
      'Cuối từ ("dark L"): phần sau lưỡi nâng lên, nghe trầm như "ồ".',
    ],
    mistakes: [
      {
        wrong: 'Lẫn /l/ và /n/ (người miền Bắc): "light" nghe như "night".',
        fix: 'Hơi ra hai bên lưỡi, không ra mũi.',
      },
      {
        wrong:
          'Bỏ /l/ cuối hoặc đọc thành "u": "feel" thành "phiu", "school" thành "xờ-cu".',
        fix: 'Giữ lưỡi chạm lợi ở cuối từ.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[l]eg', '[l]ight', '[l]ove', '[l]ook'] },
      {
        label: 'Giữa từ',
        items: ['he[ll]o', 'ye[ll]ow', 'fami[l]y', 'he[l]p'],
      },
      { label: 'Cuối từ', items: ['fee[l]', 'ca[ll]', 'schoo[l]', 'pee[l]'] },
    ],
    pairs: [
      {
        with: 'n',
        items: [
          ['light', 'night'],
          ['low', 'know'],
          ['lead', 'need'],
          ['slow', 'snow'],
        ],
      },
      {
        with: 'r',
        items: [
          ['light', 'right'],
          ['long', 'wrong'],
          ['glass', 'grass'],
          ['lock', 'rock'],
        ],
      },
    ],
    phrases: ['Lily likes yellow lemons.', 'I feel well at school.'],
    video: 'CwWLgmMk0Z0',
  },
  r: {
    traits: ['Rung', 'Lưỡi cong, không chạm'],
    steps: [
      'Cong đầu lưỡi về phía sau, không chạm vòm miệng.',
      'Môi hơi tròn và đưa ra trước.',
      'Dây thanh rung, lưỡi không rung như "r" tiếng Việt.',
      'Giọng Anh không đọc r khi sau nó không có nguyên âm (car, hard).',
    ],
    mistakes: [
      {
        wrong: 'Rung lưỡi như "r" tiếng Việt hoặc đọc thành "z".',
        fix: 'Lưỡi cong và giữ yên, không chạm đâu cả.',
      },
      {
        wrong: 'Lẫn với /l/: "right" nghe như "light".',
        fix: '/l/ đầu lưỡi chạm lợi, /r/ không chạm.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[r]ed', '[r]ight', '[r]ead', '[wr]ite'] },
      { label: 'Giữa từ', items: ['ve[r]y', 'so[rr]y', 'ca[rr]y', 'pa[r]ent'] },
      {
        label: 'Sau phụ âm',
        items: ['t[r]ee', 'g[r]een', 'b[r]ead', 'f[r]iend'],
      },
    ],
    pairs: [
      {
        with: 'l',
        items: [
          ['right', 'light'],
          ['wrong', 'long'],
          ['grass', 'glass'],
          ['rock', 'lock'],
        ],
      },
    ],
    phrases: ['Red roses are really pretty.', 'Write the right answer.'],
    video: 'Lxuo14hjP_8',
  },
  w: {
    traits: ['Rung', 'Tròn môi'],
    steps: [
      'Chu môi tròn và nhỏ như khi nói "u".',
      'Mở môi ra nhanh sang nguyên âm phía sau.',
      'Giống "qu" / "oa" tiếng Việt: "we" ≈ "uy".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành /v/ (răng chạm môi): "west" nghe như "vest".',
        fix: 'Răng không chạm môi, chỉ chu môi tròn.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[w]e', '[w]et', '[w]ater', '[w]ork'] },
      {
        label: 'Viết wh / u',
        items: ['[wh]en', '[wh]at', 'q[u]een', 'q[u]ick'],
      },
      {
        label: 'Giữa từ',
        items: ['a[w]ay', 'al[w]ays', 'be[t]ween', 'some[w]here'],
      },
    ],
    pairs: [
      {
        with: 'v',
        items: [
          ['west', 'vest'],
          ['wine', 'vine'],
          ['wet', 'vet'],
          ['wary', 'very'],
        ],
      },
    ],
    phrases: ['We want warm water.', 'Where were you on Wednesday?'],
    video: 'HzhPB1hXG-o',
  },
  y: {
    traits: ['Rung', 'Lưỡi nâng cao'],
    steps: [
      'Nâng mặt lưỡi lên gần vòm cứng như khi nói "i".',
      'Trượt nhanh sang nguyên âm phía sau.',
      'Giống "d" giọng miền Nam: "yes" ≈ "dét".',
    ],
    mistakes: [
      {
        wrong: 'Đọc thành "gi" / "d" miền Bắc hoặc /dʒ/: "yes" thành "giét".',
        fix: 'Lưỡi không chạm vòm, chỉ trượt từ "i" sang.',
      },
    ],
    words: [
      { label: 'Đầu từ', items: ['[y]es', '[y]ou', '[y]ear', '[y]ellow'] },
      { label: 'Viết u', items: ['[u]se', 'm[u]sic', 'c[u]te', 'h[u]ge'] },
      { label: 'Viết khác', items: ['b[e]auty', 'v[i]ew', 'f[e]w', 'on[i]on'] },
    ],
    pairs: [
      {
        with: 'j',
        items: [
          ['yet', 'jet'],
          ['yes', 'Jess'],
          ['year', 'jeer'],
          ['yolk', 'joke'],
        ],
      },
    ],
    phrases: ['Yes, you used yellow.', 'A few young people.'],
    video: '_Fi9E6Yw-qg',
  },
}
