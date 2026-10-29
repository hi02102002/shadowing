-- Ảnh bài đọc English Vocabulary in Use (/__/) từng gắn cho mọi từ trong cùng mục → bỏ;
-- xoá info để lần học sau tra lại, khi đó chỉ gắn ảnh nếu ảnh chỉ thuộc về một từ
UPDATE `cards` SET `image_url` = NULL, `info` = NULL WHERE `image_url` LIKE '/api/essential-media/%/\_\_/%' ESCAPE '\';
