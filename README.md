# CodeQuiz – ôn thi Kỹ thuật lập trình C (Chương 1–4)

Ứng dụng web trắc nghiệm tối giản, frontend JavaScript thuần và backend Node.js.

## Ngân hàng đề: CHỈ A / B có nguồn slide

**220 câu đã lọc** từ ngân hàng ban đầu 233 câu, dựa trên bốn file bài giảng gốc người học cung cấp:

| Chương | Số câu |
|---|---:|
| 1. Tổng quan về kỹ thuật lập trình | 42 |
| 2. Giới thiệu ngôn ngữ lập trình C | 61 |
| 3. Vào/ra dữ liệu và cấu trúc điều khiển | 58 |
| 4. Các kiểu dữ liệu có cấu trúc | 59 |

- **Loại A:** Ghi nhớ/nhắc lại nội dung có trên slide (câu có thể được diễn đạt lại, không nhất thiết chép nguyên văn).
- **Loại B:** Hiểu/vận dụng từ quy tắc, cú pháp, ví dụ được giới thiệu trong slide, có thể thay số liệu hoặc tình huống.
- **Loại C:** Kiến thức ngoài slide, giải thích thêm theo chuẩn C, hoặc sửa nội dung bài giảng; **không xuất hiện trong ngân hàng đề hiện tại**.

Mỗi câu lưu `source.category` và `source.references` (chương, số slide, đánh số trang từ slide tiêu đề là 1). Sau khi trả lời, ứng dụng hiển thị nguồn slide. 13 câu bị loại được thống kê ở [docs/source-audit.md](docs/source-audit.md).

**Lưu ý:** Đây là bộ câu hỏi *được biên soạn từ giáo trình*, không phải bản sao nguyên văn của slide hay bộ câu hỏi chính thức của giảng viên. Khi có khác biệt giữa ví dụ cũ trong slide và chuẩn C hiện hành, những câu kiểm tra khác biệt đó được loại ra khỏi chế độ ôn thi này.

## Chạy trên máy

Yêu cầu Node.js 20 trở lên:

```bash
npm start
```

Mở http://localhost:3000.

```bash
npm test
```

## Chức năng

- Mỗi đề 40 câu, chia đều 10 câu cho mỗi chương, xáo trộn câu hỏi và vị trí đáp án.
- Chấm ngay khi chọn, xem giải thích + nguồn slide, có thể mở tiếp mã đề.
- Mỗi chương có hàng đợi riêng, không lặp cho đến khi hết chu kỳ của chương, không lặp một câu trong cùng đề.
- Backend giữ câu trả lời đúng và trạng thái bài làm. Frontend không nhận đáp án đúng trước khi trả lời.
- Lưu trạng thái tại `backend/storage/state.json` (tự tạo, không commit). **Khi thay đổi ngân hàng đề, trạng thái các mã đề cũ sẽ được làm mới** để tránh câu bị loại xuất hiện lại.

## API

`GET /api/meta`, `POST /api/exams`, `GET /api/exams/:code`, `POST /api/exams/:code/answers`, `POST /api/exams/:code/finish`, `GET /api/history`.

Đây là ứng dụng học tập đơn người dùng chạy cục bộ; nếu triển khai công khai nhiều người dùng, nên thêm xác thực, phân quyền, lưu trữ cơ sở dữ liệu và xử lý đồng thời.
