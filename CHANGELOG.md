# Nhật ký thay đổi

Những gì mới trong từng phiên bản của Shadowing. Mỗi bản phát hành trên GitHub hiện đúng phần của phiên bản đó.

## 0.0.49 — 2026-11-09

### Mới

- **Quay video bài nộp cho cô giáo (Shadowing & Luyện phát âm)**:
  - Tích hợp thanh công cụ quay video bài nộp trên cả hai trang **Shadowing** (`/videos/$videoId/shadow`) và **Phát âm** (`/videos/$videoId/pronounce`).
  - **Khung Camera khẩu hình nổi (Webcam Bubble)**: hỗ trợ bật/tắt camera riêng biệt, kéo thả tự do mọi vị trí trên màn hình, đổi hình dạng (hình tròn / hình chữ nhật bo góc), đổi kích cỡ (S/M/L) và có nút **"Dừng quay"** ngay dưới khung camera.
  - **Bộ chọn dải câu nộp bài trực quan**: cho phép chọn nhanh câu hiện tại, từ câu hiện tại đến hết bài, toàn bài hoặc tuỳ chọn dải câu kèm dropdown hiển thị rõ nội dung và thời gian của từng câu. Có card xem trước phụ đề tiếng Anh và danh sách tất cả các câu trong bài.
  - **Trộn âm thanh tự động**: kết hợp âm thanh micro của học sinh và âm thanh bài học từ trình duyệt để cô giáo nghe rõ cả khẩu hình và ngữ điệu bài học.
  - Sau khi quay xong, học sinh có thể xem lại video trực tiếp và tải file về máy (`.webm`) để nộp bài.

### Sửa lỗi

- **Lỗi crash `MediaRecorder's state is 'recording'`**: tách hoàn toàn logic đếm ngược và khởi động MediaRecorder ra khỏi React state updater để ngăn chặn hiện tượng double-invocation và xung đột render chu kỳ.
- Không tự động ngắt quãng playback video khi chuyển câu trong quá trình quay Shadowing.

## 0.0.48 — 2026-11-09

### Cải thiện

- **Lịch sử luyện phát âm (Pronunciation History)**: thay danh sách nhận xét dài dòng hiển thị trực tiếp trong từng dòng lịch sử bằng nút bấm **"Nhận xét AI (N)"** / **"Xem chi tiết"** mở hộp thoại Dialog chi tiết.
- Dialog hiển thị trực quan và đầy đủ y như phần chấm bài trực tiếp: các vòng tròn điểm số (Chính xác, Đầy đủ, Trôi chảy, Tốc độ WPM), bảng so sánh từ (`DiffView`), nghe lại bản ghi âm câu nói (`/api/pronunciation-audio/:id`) và nghe câu gốc, nhận xét tổng quan của AI, chi tiết từng lỗi (phiên âm IPA, từ bạn đọc, loại lỗi, giải thích, mẹo khẩu hình, video ví dụ) cùng bài tập luyện lại ngắn có nút bấm nghe phát âm mẫu.

## 0.0.47 — 2026-11-09

### Sửa lỗi

- **Mở video bị lỗi "i is not a function"**: tách logic database của tính năng chỉnh sửa phân đoạn (split/merge segments) ra khỏi endpoint server function để tránh Vite bundle mã server và thư viện `better-sqlite3` vào client bundle của trang chi tiết video.

## 0.0.46 — 2026-11-09

### Mới

- **Chỉnh sửa câu phụ đề (Tách & ghép câu)**: nút **"Chỉnh sửa câu"** (biểu tượng ✂️) trong danh sách phụ đề video cho phép ghép hai hay nhiều câu ngắn liền nhau thành một câu, hoặc bấm vào khoảng giữa hai từ để tách một câu dài thành hai câu theo ý muốn.
- Hỗ trợ hoàn tác (Undo), làm lại (Redo) và khôi phục bản gốc; các bài làm chính tả hay phát âm trước đó vẫn được lưu giữ an toàn. Toàn bộ các tab Shadowing, Chép chính tả và Luyện phát âm tự động chuyển sang luyện theo các câu vừa chia.

## 0.0.45 — 2026-11-09

### Cải thiện

- **Nói với AI**: câu trả lời hiện dần khi Vilao tạo nội dung; giọng đọc bắt đầu sau câu hoàn chỉnh đầu tiên. Giữ cách nhận giọng nói và phát âm hiện có.
- Thêm cấu hình Vilao riêng cho hội thoại trong Cài đặt AI. Khi đổi key hoặc model, app kiểm tra kết nối trước khi lưu. Phần AI khác vẫn dùng cấu hình cũ.
- Lượt hội thoại chỉ được lưu khi AI trả lời hoàn chỉnh; nếu luồng bị ngắt, có thể thử lại mà không đưa câu trả lời dở vào lịch sử và nhận xét cuối buổi.

### Sửa lỗi

- Lưu cài đặt không còn báo lỗi `llmApiKey` khi API key cũ đang hiển thị dạng che.

## 0.0.44 — 2026-11-07

### Mới

- **Nghe từ trong video** (mục "Nghe từ"): gõ một từ hoặc cụm từ, app phát đúng đoạn người thật nói từ đó trong video YouTube, kèm câu có tô đậm từ cần nghe. Bấm ← → để nghe thêm giọng khác, R để nghe lại, chỉnh tốc độ 0.75×. Tìm trong các video của thư viện trước, rồi tìm thêm trên YouTube (lần đầu mất khoảng 10-25 giây, sau đó lưu lại nên mở lại tức thì).
- Mở nhanh từ bất cứ đâu: nút **"Video khác"** trong khung tra từ (nhấp đúp vào một từ), và biểu tượng 🎬 cạnh từ sai / cụm cần luyện trong phần AI phân tích lỗi.
- **Shadowing là gì? → Câu luyện theo chủ đề**: nhờ AI soạn câu ví dụ cho cả 4 phần (âm, trọng âm, ngữ điệu, nhịp điệu) theo chủ đề và cấp độ. Mở từ Lộ trình thì chủ đề và cấp độ của nhiệm vụ được điền sẵn.

## 0.0.43 — 2026-11-07

### Cải thiện

- **Bài tập luyện lại** trong phần AI phân tích lỗi: các từ/cụm tiếng Anh cần luyện (vd 'fresh fish', 'plenty of') giờ là nút 🔊 bấm vào để nghe phát âm mẫu theo giọng UK/US trong Cài đặt. Áp dụng cả cho các phân tích đã lưu trước đây.

## 0.0.42 — 2026-11-07

### Cải thiện

- **Ngữ pháp → "Giải thích tiếng Việt"** có thêm khối **Các dạng câu**: khẳng định, phủ định (kèm dạng rút gọn), nghi vấn Yes/No kèm câu trả lời ngắn và câu hỏi Wh-, mỗi dạng có công thức và ví dụ nghe được. Các mục đã giải thích trước đây sẽ được AI tạo lại theo dạng mới.

## 0.0.41 — 2026-11-05

### Mới

- **Lộ trình học cá nhân hoá** (mục "Lộ trình"): nhập mục tiêu, trình độ hiện tại → mục tiêu, thời gian và các kỹ năng muốn luyện, AI lập lộ trình theo giai đoạn → tuần → từng ngày, tự gắn video YouTube / ELLLO, bài Nghe, Đọc, Ngữ pháp, Hội thoại, Phản xạ... vào từng nhiệm vụ. Tick hoàn thành, đổi video khác, tạo lại tuần.
- **Thẻ từ trong lộ trình theo đúng chủ đề**: bấm "Vào Thẻ từ" sẽ tạo (một lần) bộ khoảng 12 thẻ từ vựng của chủ đề nhiệm vụ rồi học đúng bộ đó, thay vì mở hàng ôn chung các từ cũ.
- **Mức dùng AI** (trang Thống kê): số token và số lượt gọi AI hôm nay, 7 ngày, 30 ngày, biểu đồ 14 ngày và thống kê theo từng tính năng. Provider không báo số token (Ollama, một số proxy) thì ước lượng theo độ dài chữ và có ghi chú.

### Cải thiện

- Sinh lộ trình nhanh hơn: tạo khung lộ trình xong là vào luôn, Tuần 1 tự sinh ngay trong trang; tìm video/bài học chạy song song, có cache, ưu tiên ELLLO trước rồi mới tìm YouTube; ghi cả tuần trong một lần nên lỗi giữa chừng không để lại tuần dở dang.
- Ngữ pháp trong lộ trình khớp hơn: danh sách Unit gửi cho AI lọc theo trình độ của tuần, giữ đúng Unit AI chọn, và khi phải đổi Unit thì tên + mô tả nhiệm vụ được viết lại cho khớp.

### Sửa lỗi

- Nhiệm vụ Luyện IPA trong lộ trình không còn hiện "/undefined/".

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
