# Third-party content

File này được sinh bởi `pnpm chunks:build`. Kho chunks là **source-only**: không có câu hoặc bản dịch tự biên soạn và không đặt giới hạn số lượng.

| Nguồn | Giấy phép/chính sách | Cách dùng |
|---|---|---|
| [Tatoeba](https://tatoeba.org/) | CC BY 2.0 FR | Câu tiếng Anh và bản dịch tiếng Việt; từng record giữ sentence ID và tác giả. |
| [CEFR-J Vocabulary Profile](https://github.com/openlanguageprofiles/olp-en-cefrj) | CEFR-J terms with attribution | Gán cấp A1–B2 theo toàn bộ headword trong câu. |
| [Octanove Vocabulary Profile C1/C2](https://github.com/openlanguageprofiles/olp-en-cefrj) | CC BY-SA 4.0 | Gán cấp C1; mục C2 không được nhập vào kho A1–C1. |
| [Open English WordNet 2025](https://en-word.net/) | CC BY 4.0 | Phrasal verb, collocation, từ nối nhiều từ và định nghĩa tiếng Anh; chỉ giữ cụm có câu ví dụ Anh–Việt trên Tatoeba. |
| [Mozilla Common Voice](https://commonvoice.mozilla.org/) | CC0-1.0 | Audio người thật đọc (tuỳ chọn, chỉ khi chạy `pnpm chunks:import:common-voice` với bộ dữ liệu tải về máy). |

Khung câu đầu câu (vd. “Would you like to …”) được đếm tần suất trên toàn bộ câu tiếng Anh Tatoeba; câu ví dụ và bản dịch là câu Tatoeba nguyên văn, ghi ID và tác giả từng câu.

Snapshot hiện tại được tạo từ weekly exports Tatoeba ngày 2026-10-31. Audio Tatoeba không được nhập vì giấy phép audio tách riêng theo người đóng góp.

## Nguồn chỉ tham khảo

English Vocabulary Profile, PHaVE List, Wiktionary, LancsLex và The Book of Chunks from CONYE không được pipeline nhập làm nội dung, ví dụ hoặc audio.
