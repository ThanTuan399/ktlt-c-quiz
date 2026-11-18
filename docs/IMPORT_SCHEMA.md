# Tiêu chuẩn giao diện nhập ngân hàng đề (schemaVersion 1)

## Quy trình

`Tệp JSON/CSV` → parser → chuẩn hóa trường → kiểm định từng câu và ID → lập kế hoạch theo `mode` → preview → xác nhận `expectedRevision` → atomic write → reload ngân hàng → reset đề cũ.

## Trường dữ liệu

| Canonical | JSON thay thế | CSV header | Kiểu/điều kiện |
|---|---|---|---|
| `id` | `id` | `id` | Chuỗi ID duy nhất 1–80 ký tự |
| `chapter` | `chapter` | `chapter` | Số nguyên 1–999 |
| `topic` | `topic` | `topic` | Chuỗi mô tả mục (tùy chọn) |
| `level` | `level` | `level` | Mức độ (tùy chọn) |
| `q` | `question`, `q` | `question` | 5–5000 ký tự |
| `opts` | `options`, `opts` | `optionA` ... `optionD` | 4 phương án không rỗng, khác nhau theo ký tự, phân biệt hoa/thường |
| `a` | `correctAnswer`, `correctIndex`, `a` | `correctAnswer` | Chữ A–D hoặc số 0–3 |
| `why` | `explanation`, `why` | `explanation` | 4–5000 ký tự |
| `source.category` | `category`, `source.category` | `category` | `A` hoặc `B` |
| `source.references` | `sourceRefs`, `source.references` | `sourceRefs` | Ít nhất một `chapter:slide`, ví dụ `1:10;1:12` |

Ngân hàng được chuẩn hóa thành `[{id,chapter,topic,level,q,opts,a,why,source}]` và không được băm đáp án trước khi lưu; quá trình sinh đề tạo `order` cho từng câu để xáo trộn các lựa chọn. Đáp án đúng chỉ được công khai cho câu đã trả lời.

## Quy tắc xung đột

- `replace`: thay toàn bộ bằng các câu trong tệp; có thể thay số chương và số câu hoàn toàn.
- `append`: từ chối nếu ID đã có ở ngân hàng cũ; không ghi nếu có dù chỉ một lỗi.
- `upsert`: cùng ID thì ghi đè phiên bản mới; khác ID thì thêm.
- ID trùng **ngay trong tệp nhập** luôn bị từ chối ở cả ba chế độ.
- `expectedRevision` (SHA-256 nội dung đã chuẩn hóa) ngăn áp dụng bản xem trước khi ngân hàng hiện hành đã đổi.
- Các đề cũ được đặt lại sau khi thay nội dung ngân hàng; không có trường hợp câu bị xóa vẫn xuất hiện qua đề trước đó.

## Vấn đề bằng chứng slide

Chế độ này *yêu cầu có khai báo* loại A/B và nguồn slide, **không tự thực hiện đối chiếu ngữ nghĩa** với bản PowerPoint gốc. Việc xác minh slide được thực hiện lúc người biên soạn xây dựng ngân hàng. `source.references` là thông tin truy xuất nguồn, không phải dấu xác nhận kiểm chứng tự động.
