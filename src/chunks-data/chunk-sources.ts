import type { ChunkSourceInfo } from '#/lib/chunks'

/** Nguồn reference-only không được trở thành attribution role=content/example/audio. */
export const CHUNK_SOURCES: ChunkSourceInfo[] = [
  {
    id: 'cefr-j',
    name: 'CEFR-J Vocabulary and Grammar Profiles',
    homepage: 'https://github.com/openlanguageprofiles/olp-en-cefrj',
    license: 'CEFR-J-ATTRIBUTION',
    usage: 'active',
    noteVi: 'Gán cấp A1–B2 theo headword; ghi nguồn Tono Laboratory, TUFS.',
  },
  {
    id: 'octanove',
    name: 'Octanove Vocabulary Profile C1/C2',
    homepage: 'https://github.com/openlanguageprofiles/olp-en-cefrj',
    license: 'CC BY-SA 4.0',
    usage: 'active',
    noteVi: 'Gán cấp C1; các mục C2 không được nhập vào kho A1–C1.',
  },
  {
    id: 'open-english-wordnet',
    name: 'Open English WordNet',
    homepage: 'https://en-word.net/',
    license: 'CC BY 4.0',
    usage: 'active',
    noteVi:
      'Phrasal verb, collocation, từ nối nhiều từ kèm định nghĩa tiếng Anh; chỉ giữ cụm có câu ví dụ Anh–Việt trên Tatoeba.',
  },
  {
    id: 'oanc',
    name: 'Open American National Corpus',
    homepage: 'https://lapps.anc.org/',
    license: 'OANC-OPEN',
    usage: 'supported',
    noteVi: 'Dùng làm tín hiệu tần suất và ngữ cảnh tiếng Anh hiện đại.',
  },
  {
    id: 'tatoeba',
    name: 'Tatoeba',
    homepage: 'https://tatoeba.org/',
    license: 'CC BY 2.0 FR',
    usage: 'active',
    noteVi:
      'Cung cấp câu Anh–Việt; mỗi phía đều giữ sentence ID, tác giả, URL và giấy phép.',
  },
  {
    id: 'voa',
    name: 'VOA Learning English',
    homepage: 'https://learningenglish.voanews.com/',
    license: 'PUBLIC DOMAIN',
    usage: 'supported',
    noteVi:
      'Chưa nhập: tên miền VOA bị chặn trên mạng Việt Nam nên không tải snapshot được. Nếu nhập, chỉ dùng bài VOA tự viết; loại AP, Reuters, AFP.',
  },
  {
    id: 'common-voice',
    name: 'Mozilla Common Voice',
    homepage: 'https://commonvoice.mozilla.org/',
    license: 'CC0-1.0',
    usage: 'active',
    noteVi:
      'Tuỳ chọn: tải bộ dữ liệu về máy rồi chạy pnpm chunks:import:common-voice; chỉ nhận clip validated có transcript khớp chính xác câu ví dụ.',
  },
  {
    id: 'english-vocabulary-profile',
    name: 'English Vocabulary Profile',
    homepage: 'https://englishprofile.org/wordlists/evp',
    license: 'REFERENCE-ONLY',
    usage: 'reference-only',
    noteVi: 'Chỉ kiểm chứng CEFR; không sao chép dữ liệu vào ứng dụng.',
  },
  {
    id: 'phave',
    name: 'PHaVE List',
    homepage: 'https://doi.org/10.1177/1362168814559798',
    license: 'REFERENCE-ONLY',
    usage: 'reference-only',
    noteVi: 'Chỉ kiểm chứng độ hữu dụng của phrasal verb.',
  },
  {
    id: 'wiktionary',
    name: 'Wiktionary',
    homepage: 'https://en.wiktionary.org/',
    license: 'REFERENCE-ONLY',
    usage: 'reference-only',
    noteVi:
      'Chỉ tham khảo trong v1 để tránh kéo nghĩa vụ CC BY-SA/GFDL vào seed.',
  },
  {
    id: 'lancslex',
    name: 'LancsLex',
    homepage: 'https://lancslex.lancaster.ac.uk/',
    license: 'CC BY-NC-ND',
    usage: 'reference-only',
    noteVi: 'Chỉ kiểm chứng tần suất; không đóng gói vì điều kiện NC-ND.',
  },
  {
    id: 'conye-book-of-chunks',
    name: 'The Book of Chunks from CONYE',
    homepage:
      'https://www.britishcouncil.cn/sites/default/files/the_book_of_chunks_from_conye23_without_metadata.pdf',
    license: 'ALL RIGHTS RESERVED',
    usage: 'reference-only',
    noteVi:
      'Copyright © TransformELT 2023, không đưa vào seed. Bạn có thể tự nhập bản PDF của mình ở trang Chunks: dữ liệu chỉ lưu trên máy bạn.',
  },
]
