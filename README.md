# CodeQuiz 2.0 – Web trắc nghiệm có thể nạp ngân hàng đề

Frontend HTML/CSS/JavaScript; backend Node.js 20+ (không cần package bên ngoài). Ngân hàng đề là **dữ liệu runtime**, không còn gắn cứng vào logic tạo đề.

## Bắt đầu

```bash
npm start
```

Truy cập **http://localhost:3000**. Kiểm thử: `npm test`.

Trang **Luyện tập**: chọn chương, số câu mỗi chương (mặc định 4 chương × 10 = 40); tạo mã đề; trả lời và được chấm ngay.

Trang **Ngân hàng đề**: tải mẫu JSON/CSV, chọn tệp, chọn cách nhập, **Kiểm tra dữ liệu trước khi nhập**, xem thống kê và lỗi từng dòng, sau đó **Xác nhận nạp ngân hàng**. Có thể tải toàn bộ ngân hàng hiện tại về làm bản sao lưu.

## Nguyên tắc nạp dữ liệu

1. **Định dạng:** JSON UTF-8 (`[{...}]` hoặc `{ "schemaVersion": 1, "name": "...", "questions": [...] }`) và CSV UTF-8 (có dòng tiêu đề đúng mẫu). Giới hạn 5 MB / 20.000 câu một lần nạp.
2. **Chuẩn mỗi câu:** `id` duy nhất, `chapter` nguyên dương, nội dung `question`/`q`, **4 phương án khác nhau** `options`/`opts`, `correctAnswer` là A/B/C/D hoặc `a` 0–3, `explanation`/`why`, `category` = A/B, ít nhất một nguồn `sourceRefs` (CSV `1:10;1:11`) hoặc JSON `source.references: [{chapter:1,slide:10}]`. Các lựa chọn phân biệt chữ hoa chữ thường (quan trọng khi hỏi lập trình C).
3. **Phân loại:** A – ghi nhớ trực tiếp từ slide; B – hiểu/vận dụng từ slide. Không chấp nhận C hoặc câu không có tham chiếu. Ứng dụng kiểm tra **cấu trúc và khai báo nguồn**, không tự xác minh nội dung có thật trên slide: người biên soạn phải đảm bảo trích nguồn đúng.
4. **Xem trước:** không thay đổi dữ liệu. Nếu có lỗi định dạng, thiếu trường, trùng ID trong tệp, hoặc xung đột ở chế độ chỉ thêm thì không thể nhập.
5. **Ba chế độ:** `replace` thay toàn bộ; `append` chỉ thêm ID mới và từ chối ID trùng; `upsert` cập nhật theo ID và thêm ID mới. Trong `replace`, ngân hàng nguồn hiện tại được thay thế thực sự; không có câu hỏi được cố định trong mã nguồn logic.
6. **An toàn dữ liệu:** `expectedRevision` được kiểm tra để tránh ghi đè thay đổi giữa xem trước và áp dụng. Ghi file thông qua temp file và rename. Sau khi thay ngân hàng, mã đề và lịch sử cũ sẽ được đặt lại để không chứa câu cũ.
7. **Tính linh hoạt:** có thể nạp ngân hàng với bất kỳ số chương (1–999), chọn chương bất kỳ đủ câu để tạo đề, chọn số câu/chương, xáo trộn đáp án. Mỗi chương có hàng đợi riêng, các câu chỉ được lặp khi đã đi hết vòng của chương đó; không trùng trong cùng một đề.

## Ví dụ JSON chuẩn

```json
{
  "schemaVersion": 1,
  "name": "Ngân hàng luyện tập mẫu",
  "questions": [
    {
      "id": "C1-001", "chapter": 1, "topic": "1.1 Giải thuật", "level": "Nhớ",
      "question": "Thuật toán có đặc điểm nào dưới đây?",
      "options": ["Có số bước hữu hạn", "Bất kỳ số bước vô tận", "Không cần đầu vào", "Không cần đầu ra"],
      "correctAnswer": "A", "explanation": "Thuật toán gồm một số hữu hạn bước.",
      "category": "A", "sourceRefs": "1:10"
    }
  ]
}
```

Trong JSON cũng hỗ trợ trường legacy `q`, `opts`, `a`, `why`, `source: {"category":"A","references":[{"chapter":1,"slide":10}]}`; nhờ vậy có thể xuất và nhập lại dữ liệu ở dạng chuẩn hóa. Ví dụ trên chỉ minh họa **định dạng**, không phải trích dẫn đã được kiểm định.

## Kiến trúc

```text
frontend/
  index.html          Giao diện, cấu hình đề, màn hình import
  app.js              Truy cập REST API và phản hồi người dùng
  styles.css          Giao diện đơn giản, responsive
backend/
  data/questions.json Bộ dữ liệu khởi tạo 220 câu A/B (để chạy lần đầu)
  storage/             Dữ liệu chạy thực tế, không commit
    active-bank.json  Xuất hiện khi nhập ngân hàng mới
    state.json        Hàng đợi và tiến độ mã đề
  src/
    server.js         HTTP/router/static files
    shared/util.js    AppError/hash/atomic write/shuffle
    bank/csv.js       Parser CSV & exporter
    bank/validation.js  Parse/normalize/validate từng câu
    bank/repository.js Lưu trữ, preview, append/upsert/replace
    quiz/service.js  Đề thi, hàng đợi không lặp, chấm điểm

tests/
  bank.test.js        Kiểm tra schema/import/generator
  api.test.js         Kiểm thử các endpoint thực tế
```

## API

| Method | Endpoint | Ý nghĩa |
|---|---|---|
| GET | `/api/bank/meta` | Tên, revision, số câu, chương, phân loại |
| GET | `/api/bank/export` | Xuất ngân hàng JSON đang hoạt động |
| GET | `/api/bank/template?format=json` | Tải mẫu JSON |
| GET | `/api/bank/template?format=csv` | Tải mẫu CSV |
| POST | `/api/bank/preview` | `{format,content,mode}` — không ghi dữ liệu |
| POST | `/api/bank/import` | `{format,content,mode,expectedRevision}` — áp dụng dữ liệu |
| GET | `/api/meta` | Thống kê đề + ngân hàng |
| POST | `/api/exams` | `{chapters:[1,2,3,4],perChapter:10}` |
| GET | `/api/exams/:code` | Lấy đề hoặc tiến độ, không lộ đáp án chưa làm |
| POST | `/api/exams/:code/answers` | `{questionId,selectedIndex}` |
| POST | `/api/exams/:code/finish` | Kết thúc và chấm đề |
| GET | `/api/history` | Mã đề gần đây |

## Giới hạn và triển khai

Ứng dụng mặc định chỉ nghe `127.0.0.1` và dành cho **một người dùng trên máy cá nhân**. Các endpoint ngân hàng cho phép đọc đáp án và thay dữ liệu: **KHÔNG** đặt `HOST=0.0.0.0` để công khai API khi chưa thêm xác thực, phân quyền quản trị, HTTPS, rate limiting và cơ sở dữ liệu/khóa đồng thời. Tệp `active-bank.json` và `state.json` nằm trong `.gitignore`; `git pull` không xóa dữ liệu đã nhập trên cùng máy.

Ngân hàng đề gốc (220 câu được biên soạn, lọc từ 4 chương bài giảng) là **dữ liệu khởi tạo**, không khóa hệ thống: ngay lần đầu nạp thành công, ứng dụng lấy dữ liệu từ `backend/storage/active-bank.json` thay vì bộ khởi tạo.
