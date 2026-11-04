# Kho chunks source-only

`pnpm chunks:build` chỉ đọc các snapshot `src/chunks-data/sources/*.source.jsonl`. Không có fallback tự biên soạn, không lấy dữ liệu qua mạng lúc app chạy và không giới hạn số lượng chunk.

Snapshot hiện tại được tạo từ cặp câu Anh–Việt liên kết trực tiếp trong weekly exports của Tatoeba. Mỗi record giữ ID và tác giả của cả câu tiếng Anh lẫn bản dịch tiếng Việt. CEFR được gán theo cấp cao nhất của toàn bộ headword trong CEFR-J/Octanove; câu có từ không xác định cấp bị loại.

## Cập nhật snapshot Tatoeba

Tải các export chính thức vào thư mục tạm:

```sh
curl -L https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_detailed.tsv.bz2 -o /tmp/tatoeba-eng.tsv.bz2
curl -L https://downloads.tatoeba.org/exports/per_language/vie/vie_sentences_detailed.tsv.bz2 -o /tmp/tatoeba-vie.tsv.bz2
curl -L https://downloads.tatoeba.org/exports/links.tar.bz2 -o /tmp/tatoeba-links.tar.bz2
curl -L https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv -o /tmp/cefrj-vocab.csv
curl -L https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv -o /tmp/octanove.csv
pnpm chunks:import:tatoeba
pnpm chunks:build
```

Importer không đặt `limit` hoặc quota theo cấp. Số lượng đầu ra thay đổi theo weekly export và các điều kiện QA:

- câu tiếng Anh dài 2–12 từ, có tác giả và dấu kết câu;
- có bản dịch tiếng Việt liên kết trực tiếp và có tác giả;
- mọi từ tiếng Anh đều gán được A1–C1 bằng CEFR-J/Octanove;
- loại C2, URL, markup, denylist và cặp trùng sau chuẩn hóa;
- không nhập audio Tatoeba vì giấy phép audio được công bố riêng theo người đóng góp.

## Cụm từ: Open English WordNet + khung câu Tatoeba

```sh
curl -L https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025-json.zip -o /tmp/oewn.zip
unzip -o /tmp/oewn.zip -d /tmp/oewn-2025-json
pnpm chunks:import:phrases   # dùng lại các export Tatoeba và CEFR-J ở trên
pnpm chunks:build
```

- Cụm nhiều từ (2–5 từ) của OEWN, mọi từ thuộc A1–C1, có ít nhất một câu Anh–Việt Tatoeba chứa cụm (danh từ/tính từ ghép: ít nhất hai câu) và xuất hiện ≥ 3 lần trong toàn bộ câu tiếng Anh Tatoeba.
- Bỏ động từ hai từ + giới từ (`live in`, `go to`…) vì câu ví dụ thường dùng theo nghĩa đen, lệch nghĩa thành ngữ; bỏ cụm có `be`/`do` đứng đầu.
- Từ nối: cụm trạng từ mở đầu ≥ 3 câu Tatoeba kèm dấu phẩy (`Of course, …`).
- Khung câu: 3–4 từ đầu câu lặp lại ≥ 150 lần trong câu tiếng Anh Tatoeba (`--min-frame`).
- Định nghĩa tiếng Anh lấy từ OEWN (tối đa 2 nghĩa đầu). Không có nghĩa tiếng Việt tự biên soạn: tiếng Việt là bản dịch Tatoeba của câu ví dụ, ghi ID và tác giả từng câu.

## Audio Common Voice (tuỳ chọn)

Bộ dữ liệu Common Voice cần đăng nhập để tải nên không tự động hoá được. Tải bản tiếng Anh về máy rồi:

```sh
pnpm chunks:import:common-voice --dir ~/Downloads/cv-corpus-xx/en
pnpm chunks:build
```

Chỉ nhận clip trong `validated.tsv` có phiếu thuận nhiều hơn phiếu chống và transcript khớp chính xác (sau chuẩn hoá) câu ví dụ; mỗi câu một clip. Clip được chép vào `public/chunk-audio/` và đóng gói cùng ứng dụng, nên dung lượng tăng theo số clip khớp.

## VOA Learning English

Chưa nhập: tên miền VOA bị chặn ở tầng DNS trên mạng Việt Nam nên không tải được snapshot từ máy build hiện tại.

English Vocabulary Profile, PHaVE, Wiktionary và LancsLex vẫn chỉ dùng tham khảo, không được tạo snapshot nội dung.

The Book of Chunks from CONYE cũng là nguồn chỉ tham khảo: tài liệu ghi “All rights reserved” và yêu cầu xin phép tác giả hoặc nhà xuất bản trước khi sao chép hay truyền tải nội dung. Người dùng có thể tự nhập bản PDF của mình ở trang `/chunks/mine`: chunk chỉ lưu trong DB trên máy họ (bảng `user_chunks`), không vào seed, repo hay bản phát hành.

`sourceVerified: true` chỉ xác nhận provenance, giấy phép và liên kết nguồn. `reviewed: true` được dành riêng cho lần duyệt thủ công nghĩa, CEFR và tính tự nhiên; importer không tự đặt cờ này.
