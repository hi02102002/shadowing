# Nhật ký thay đổi

Những gì mới trong từng phiên bản của Shadowing. Mỗi bản phát hành trên GitHub hiện đúng phần của phiên bản đó.

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
