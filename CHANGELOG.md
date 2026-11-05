# Nhật ký thay đổi

Những gì mới trong từng phiên bản của Shadowing. Mỗi bản phát hành trên GitHub hiện đúng phần của phiên bản đó.

## 0.0.40 — 2026-11-05

### Mới

- **Bài học "Shadowing là gì?"** (mục Luyện IPA → nút "Shadowing là gì?"): giải thích 4 trụ cột của shadowing là âm, trọng âm, ngữ điệu và nhịp điệu bằng các ví dụ cụ thể, có nghe mẫu (thường, chậm, từng cụm) và ghi âm chấm riêng cho từng trụ cột.
- **Luyện theo trụ cột ngay khi shadow và luyện phát âm video**: chọn "Luyện tập trung" (Sound, Stress, Intonation, Rhythm) để AI nhận xét tập trung vào phần đó. Sau khi chấm có khung tóm tắt 4 trụ cột, kèm tốc độ nói và các chỗ ngắt dài, bấm "Luyện phần này" để tập lại đúng phần đó. Trang shadow có thêm hướng dẫn "4 điều cần để ý khi shadowing".
- Sổ lỗi có thêm hai loại lỗi mới: ngữ điệu và nhịp điệu.

### Lưu ý

- Trọng âm và ngữ điệu hiện là nhận xét của AI, chưa đo bằng âm học; chính xác hơn khi bật chế độ AI nghe trực tiếp bản ghi trong Cài đặt.

## 0.0.39 — 2026-11-05

### Mới

- **Báo khi có bản cập nhật mới** (app desktop): hiện hộp thoại cho biết có bản mới, bạn chọn "Cập nhật" hoặc "Để sau". Không ép: chỉ tải và cài khi bạn bấm, "Để sau" thì không hỏi lại cho đến khi có bản mới hơn. Vẫn cập nhật được trong Cài đặt như trước.

## 0.0.38 — 2026-11-05

### Sửa lỗi

- **Xuất Anki: mọi chunk và câu ví dụ đều có nút nghe.** Trước đây nhiều thành ngữ không có giọng vì Youdao thiếu audio; giờ giọng đọc đi qua chuỗi dự phòng của app (Youdao → Google) và tải có giới hạn luồng, tự thử lại khi lỗi.
- **Đọc hiểu / Nói với AI / Luyện nói:** thoát trang là giọng đọc mẫu dừng hẳn, không còn chạy tiếp kèm nút pause của trình duyệt.
- Xuất lại bộ thẻ vào Anki không tạo thêm kiểu thẻ (note type) trùng; tên file tải về giữ nguyên chữ tiếng Việt; thẻ tự thêm trùng mặt trước không còn đè lên nhau.
- Trang "Tạo Anki": cụm từ được gộp đúng vào thẻ của từ đã chọn dù AI đổi dạng từ.

## 0.0.37 — 2026-11-05

### Mới

- **Xuất bộ thẻ ra Anki (.apkg)**: nút tải xuống trên từng bộ thẻ và trên cả nhóm sách trong mục "Thẻ từ".
  - Bộ thuộc sách xuất thành deck lồng nhau "Tên sách::Unit", xuất cả sách thì deck cha chứa các unit.
  - Ảnh (Bing) và giọng đọc Anh (Youdao) được tạo sẵn và nhúng vào file để học offline; thẻ sách chưa học được bổ sung nghĩa Việt, ví dụ, chunks trước khi xuất.
  - Thẻ có badge loại từ, IPA, hộp nghĩa Việt / định nghĩa tiếng Anh, khung Lexical Chunks và câu ví dụ, có chế độ tối của Anki. Nút nghe ở ví dụ và chunk không tự phát.
- **Tạo thẻ Anki bằng AI** (mục "Tạo Anki" trên thanh điều hướng): chọn sách và unit, dán link bài học hoặc dán danh sách từ, chọn từ vựng / cụm từ / ghi chú, AI sinh thẻ, xem trước, sửa rồi tải file .apkg.
- **Thẻ ghi chú (Language Notes)**: khi thêm unit của English Vocabulary in Use, các khung "Common mistakes" và "Language help" thành thẻ ghi chú riêng trong bộ thẻ của unit.

### Thay đổi

- Phiên âm IPA lấy từ từ điển trước (từ điển Anh–Việt, bộ CMU có sẵn), AI chỉ dùng khi không có nguồn nào khác.

## 0.0.36 — 2026-11-04

### Thay đổi

- **Chỉnh thời gian khi luyện nói với AI**
  - Nói theo đề: chọn thời gian chuẩn bị (không chuẩn bị đến 5 phút) và thời gian nói tối đa (30 giây đến 10 phút), mặc định vẫn như phòng thi: 1 phút chuẩn bị, nói 2 phút.
  - Nhập vai và IELTS Part 1 / Part 3: chọn thời gian tối đa mỗi lượt nói (10 giây đến 10 phút, mặc định 45 giây).
  - Bấm "Khác…" để tự nhập số giây; lựa chọn được nhớ cho lần sau.

## 0.0.35 — 2026-11-04

### Mới

- **Kho Chunks A1–C1** (mục "Chunks" trên thanh điều hướng)
  - Hơn 8.000 câu và cụm từ có nguồn Anh–Việt, dùng được offline: câu giao tiếp Tatoeba; phrasal verb, collocation, từ nối nhiều từ từ Open English WordNet kèm định nghĩa tiếng Anh; khung câu hay gặp như "I'd like to …", "Have you ever …".
  - Mỗi cụm có đến 3 câu ví dụ Anh–Việt thật, ghi nguồn và tác giả từng câu. Lọc theo cấp độ, chủ đề, loại chunk hoặc tìm theo tiếng Anh / tiếng Việt.
  - Bấm loa để nghe chunk và từng câu ví dụ, bấm micro để nói theo và được chấm phát âm từng từ, bấm "Lưu thẻ" để đưa vào bộ thẻ "Chunks" và ôn theo lịch.
  - Trang "Nguồn & giấy phép" liệt kê giấy phép từng nguồn.
- **Chunks của bạn**: nhập tài liệu PDF hoặc văn bản bạn đang có (vd. "The Book of Chunks"), AI lấy ra các chunk có trong tài liệu và gợi ý nghĩa tiếng Việt. Dữ liệu chỉ lưu trên máy bạn.
- **Tab Chunks trong bài học**: bài đọc, bài nghe và video tự tìm các chunk xuất hiện trong bài (kể cả dạng chia như "gave up"). Bấm vào chunk để tô sáng trong bài đọc hoặc nghe lại đúng câu trong video.

### Thay đổi

- Luyện phản xạ có thêm nguồn "Kho Chunks": nhìn câu tiếng Việt, nói câu tiếng Anh dùng đúng cụm được gợi ý.

## 0.0.34 — 2026-11-04

### Mới

- **Luyện phản xạ nói A1–C1** (mục "Phản xạ" trên thanh điều hướng)
  - 4 dạng bài: Dịch nói Việt → Anh, Hỏi nhanh – đáp nhanh (AI đọc to câu hỏi), Phản xạ tình huống và Phản xạ mẫu câu (ghép từ gợi ý vào mẫu).
  - Chọn nguồn đề: bộ câu soạn sẵn theo cấp độ, hơn 30.000 cặp câu Việt–Anh từ Tatoeba, hàng nghìn câu hỏi hội thoại theo hơn 200 chủ đề từ iTESLj, hoặc để AI soạn theo chủ đề bạn muốn.
  - Đề hiện ra là micro bật ngay, đồng hồ đếm ngược 3–30 giây mỗi câu (mặc định theo dạng bài và cấp độ); phím Enter để bắt đầu, dừng và sang câu tiếp.
  - AI chấm từng câu ngay: điểm 0–10, đúng ý hay chưa, câu nên nói (nghe được), lỗi cần sửa kèm giải thích tiếng Việt, và thời gian bạn bắt đầu nói. Bấm "Nói lại" để thử lại câu đó.
  - Cuối buổi xem điểm trung bình, thời gian phản xạ trung bình và các câu cần luyện lại; xem lại hoặc xoá các buổi trước.

### Thay đổi

- Lỗi khi luyện phản xạ được lưu vào Sổ lỗi; bộ lọc nguồn trong Sổ lỗi có thêm Hội thoại, Nói theo đề, Đọc hiểu, Luyện nghe và Phản xạ.
- Lượt luyện phản xạ được tính vào chuỗi ngày học và biểu đồ hoạt động; trang Thống kê có thêm ô "Câu phản xạ đã nói".

## 0.0.33 — 2026-11-03

### Mới

- **Luyện nghe theo cấp độ A1–C1** (mục "Luyện nghe" trên thanh điều hướng)
  - Chọn bài từ thư viện Cambridge IELTS Listening (đầy đủ 4 section, audio và bài tập gốc), Tactics for Listening, Breaking News English, Essential English Blog và hội thoại thực tế ELLLO.
  - Trình phát audio chuyên dụng: đổi tốc độ phát 0.5x–2.0x, tua nhanh/lùi 5 giây, lặp lại đoạn hoặc bài; tích hợp trình phát video Vimeo với các bài có video.
  - Xem hoặc ẩn lời thoại (transcript); AI hỗ trợ bóc băng và soạn bài tập trắc nghiệm, điền từ, True/False cho các bài chưa có sẵn câu hỏi.
  - Xem điểm số, đáp án chi tiết và giải thích tiếng Việt sau khi nộp; các câu trả lời sai tự động được lưu vào Sổ lỗi.
  - Tab Từ vựng hỗ trợ tra từ, nghe phát âm và lưu từ vựng theo khung CEFR.
- **Thanh điều hướng co giãn linh hoạt**
  - Thêm menu dạng ngăn kéo/thu gọn trên các màn hình có chiều rộng hẹp hơn, giúp chuyển đổi nhanh và không bị tràn thanh điều hướng.

### Thay đổi

- Lượt luyện nghe được tính vào chuỗi ngày học (streak) và hiển thị trong biểu đồ hoạt động ở trang Thống kê.
- Trang Sổ lỗi bổ sung phân loại và xem lại các câu nghe đã làm sai.

## 0.0.32 — 2026-11-03

### Mới

- **Đọc hiểu theo trình độ A2–C1** (mục "Đọc hiểu" trên thanh điều hướng)
  - Chọn bài từ thư viện Reading for the Real World, Cambridge IELTS 14–18, Breaking News English, OneStopEnglish và Linguapress; bài có đề gốc dùng luôn câu hỏi và đáp án gốc.
  - Để AI viết bài theo chủ đề có sẵn hoặc tự chọn, hay dán bài của bạn rồi nhờ AI soạn câu hỏi. Chọn dạng Cơ bản, IELTS Academic hoặc TOEIC Part 7 và số câu muốn luyện.
  - Hỗ trợ trắc nghiệm, True / False / Not Given, Yes / No / Not Given, nối tiêu đề, điền từ, trả lời ngắn và câu chọn nhiều đáp án trong đề gốc.
  - Sau khi nộp, xem điểm, đáp án, giải thích tiếng Việt và câu trong bài làm căn cứ; câu sai được lưu vào Sổ lỗi và hoạt động đọc được tính trong Thống kê.
- **Công cụ học ngay trên bài đọc**
  - Bôi đen để tô màu bằng bốn màu và tự lưu; nhấp đúp để tra từ nhanh.
  - Tab Từ vựng phân loại từ trong bài theo CEFR, phát âm, lưu vào bộ thẻ và tìm cụm từ / từ loại theo ngữ cảnh bằng AI khi bạn bấm yêu cầu.

## 0.0.31 — 2026-10-29

### Mới

- **Nói theo đề: chấm Pronunciation và nghe lại bài nói**
  - Khi Cài đặt chọn chấm phát âm bằng LLM nghe audio (Gemini / OpenAI), AI nghe trực tiếp bản ghi để cho band Pronunciation, band tổng tính trên cả 4 tiêu chí.
  - Mục "Lỗi phát âm": từ phát âm sai, phiên âm IPA, AI nghe ra thành gì, cách sửa; lỗi được lưu vào Sổ lỗi.
  - Nghe lại bản ghi của mình ngay trên trang kết quả.
- **IELTS Speaking Part 1 và Part 3 với AI giám khảo**
  - Part 1: bấm "Bắt đầu Part 1" ở trang Nói theo đề (hoặc chọn trong tab Nhập vai): giám khảo hỏi về bản thân, nơi ở, công việc, sở thích như phòng thi.
  - Part 3: nói xong một đề Part 2, bấm "Tiếp Part 3" để giám khảo hỏi sâu, mở rộng về chủ đề đó.
  - Kết thúc buổi để xem band ước lượng (chưa tính Pronunciation), câu nên sửa và cụm từ nên dùng. Độ khó câu hỏi theo band mục tiêu bạn chọn.

## 0.0.30 — 2026-10-29

### Mới

- **Nói với AI: nhập vai hội thoại** (mục "Nói với AI" trên thanh điều hướng, tab Nhập vai)
  - 8 tình huống có sẵn (quán cà phê, nhà hàng, hỏi đường, khách sạn, mua quần áo, khám bệnh, phỏng vấn xin việc, làm quen) hoặc tự nhập chủ đề; chọn trình độ A2 / B1 / B2.
  - Bấm mic để nói hoặc gõ câu trả lời. AI đáp ngắn gọn và tự đọc to (tắt được bằng công tắc "Tự đọc"); bấm "Gợi ý câu trả lời" nếu bí.
  - Bấm "Kết thúc & nhận xét": AI chỉ ra câu chưa đúng kèm cách nói tự nhiên hơn và giải thích tiếng Việt, gợi ý cụm từ nên dùng. Lỗi được lưu vào Sổ lỗi.
  - Xem lại hoặc xoá các buổi trước ngay trên trang.
- **Nói theo đề kiểu IELTS Speaking Part 2** (tab Nói theo đề)
  - 22 đề có sẵn chia theo nhóm, nút "Đề ngẫu nhiên", hoặc dán đề của bạn (kể cả dạng có "You should say:" và gạch đầu dòng).
  - Như phòng thi: 1 phút chuẩn bị có ô ghi ý, hết giờ tự ghi âm, nói tối đa 2 phút.
  - AI ước lượng band tổng và từng tiêu chí (Fluency & Coherence, Lexical Resource, Grammatical Range & Accuracy), đánh dấu gợi ý nào của đề bạn đã nói tới, chỉ ra câu nên sửa (lưu vào Sổ lỗi), gợi ý từ vựng và viết bài mẫu từ chính ý của bạn, có nút nghe.
  - Chọn mục tiêu Band 5–5.5 / 6–6.5 / 7+: điểm vẫn chấm như thi thật, mục tiêu chỉ đổi độ khó của bài mẫu, từ vựng và lời khuyên cho vừa sức.
  - Chưa chấm Pronunciation (AI chấm trên lời đã chép).

### Thay đổi

- Chuỗi ngày học và lịch hoạt động ở trang Thống kê tính cả lượt nói trong hội thoại và bài nói theo đề.
- Nhận dạng giọng nói khi nói tự do dùng cùng cách như chấm phát âm trong Cài đặt: LLM nghe audio, STT API, hoặc Whisper trên máy.

## 0.0.29 — 2026-10-29

### Mới

- **Thống kê và chuỗi ngày học** (trang Thống kê, bấm vào 🔥 trên thanh điều hướng)
  - Chuỗi ngày giờ tính mọi kiểu luyện: chép chính tả, luyện nói, ôn thẻ, ngữ pháp. Lửa xám nghĩa là hôm nay chưa học, luyện một lượt để giữ chuỗi.
  - Chuỗi dài nhất, tổng số ngày đã học, mục tiêu mỗi ngày (mặc định 20 lượt, sửa ngay trên trang).
  - Lịch hoạt động 12 tháng (rê chuột vào ô để xem từng loại) và điểm trung bình theo tuần của chép chính tả, phát âm.
- **Tab Từ vựng trong mỗi video**
  - Từ trong bài chia theo cấp A1–C2 (theo danh sách CEFR-J và Octanove), kèm loại từ, nghĩa tiếng Việt, số lần xuất hiện.
  - Nút "Tìm bằng AI": tìm cụm từ (phrasal verb, thành ngữ, collocation) và loại từ theo đúng câu. AI chỉ chạy khi bạn bấm; video dài được xử lý trọn bài.
  - Luyện gõ: nghe đúng câu trong video, gõ từ bị che từng chữ cái. Cuối buổi lưu các từ gõ sai (hoặc tất cả) vào bộ thẻ riêng của video, kèm câu và đoạn clip, rồi "Ôn ngay bằng chế độ gõ".
  - Bấm vào từ để xem từ điển; nghĩa AI theo câu chỉ tra khi bạn bấm.
- **Chế độ "Gõ từ" cho thẻ từ** (nút Gõ từ / Lật thẻ, `Ctrl/⌘+E`)
  - Nhìn ảnh và nghĩa, nghe phát âm, gõ từng chữ cái; sai thì báo đỏ. App tự chấm Nhớ / Khó / Quên theo cách bạn gõ.
  - Gõ xong nghe và gõ lại một câu ví dụ ngắn, có bản dịch. Câu lấy từ Tatoeba (ghi nguồn), chỉ chọn câu hoàn chỉnh 4–12 từ.
  - Công tắc "Tự chuyển tiếp" để sang từ tiếp theo khi gõ xong.
- **Ngữ pháp: tab "Luyện thêm (AI)"** trong mỗi bài
  - AI tự đặt câu mới theo đúng chủ điểm, chọn độ khó Dễ / Vừa / Khó và số câu (1–50).
  - 5 dạng bài: điền từ, trắc nghiệm, tìm & sửa lỗi, sắp xếp câu, viết lại câu. Có giải thích tiếng Việt; câu sai được ghi vào Sổ lỗi.
- **Tra từ nhanh ở mọi trang**: nhấp đúp vào một từ tiếng Anh, hoặc bôi đen một cụm rồi bấm "Tra". Tắt được trong Cài đặt → Tra từ nhanh.

### Thay đổi

- **Phụ đề bằng Whisper chính xác hơn**: model mặc định chuyển sang `large-v3-turbo` (574 MB, tự tải lần đầu tạo phụ đề). Vẫn chọn lại `small.en` được trong Cài đặt nếu máy chậm. Chấm phát âm trên máy luôn dùng `small.en` cho nhanh.
- Trang rộng bằng thanh điều hướng; Thư viện và Khám phá hiện 4 cột trên màn hình rộng.
