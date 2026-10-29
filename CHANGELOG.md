# Nhật ký thay đổi

Những gì mới trong từng phiên bản của Shadowing. Mỗi bản phát hành trên GitHub hiện đúng phần của phiên bản đó.

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
