# Biên bản rà soát nguồn – Ngân hàng 233 câu

Dữ liệu nguồn: 4 slide bài giảng *Kỹ thuật lập trình* do người học tải lên (Chương 1–4). Đánh số slide tính từ slide tiêu đề = 1.

## Kết quả

- 233 câu ban đầu → **220 câu** (A: **79** câu, B: **141** câu).
- 13 câu không được đưa vào chế độ ôn thi vì không thể quy chiếu trực tiếp vào nội dung có trên slide hoặc kiểm tra sự khác biệt giữa slide và kiến thức C chuẩn.
- Các câu còn lại có trường `source.references` trong `backend/data/questions.json`.
- Thứ tự câu/đáp án vẫn được sinh ngẫu nhiên. Mỗi đề có 10 câu cho mỗi chương.

## 13 câu bị loại

| Mã câu | Lý do |
|---|---|
| `C2-052` | Tranh luận về kích thước int theo C chuẩn không được triển khai trong slide. |
| `C3-012` | Đặc tả %% không có trong các slide printf. |
| `C3-023` | Cách viết scanf(" %c") không nằm trong bài giảng. |
| `C3-026` | Giá trị trả về scanf không được giảng trong slide. |
| `C4-023` | Sửa lại phát biểu của slide về địa chỉ phần tử mảng nhiều chiều. |
| `C4-024` | Độ phức tạp tìm kiếm tuyến tính không được nêu ở phần mảng. |
| `C4-025` | Độ phức tạp sắp xếp lựa chọn không được nêu trực tiếp ở phần mảng. |
| `C4-041` | Sửa lại nội dung hàm isspace theo C chuẩn. |
| `C4-044` | Sửa kiểu trả về atof khác với cách trình bày trên slide. |
| `C4-046` | Độ an toàn của fgets so với gets không nằm trong chương 4. |
| `C4-049` | Tính không chuẩn ISO C của strrev không được đề cập. |
| `C4-050` | Tính không chuẩn ISO C của fflush(stdin) không được đề cập. |
| `C4-064` | Toán tử -> với con trỏ struct thuộc chương 6. |

## Quy tắc phân loại

- **A:** hỏi trực tiếp khái niệm, định nghĩa, cú pháp, tính chất được nêu trong slide.
- **B:** đưa trường hợp/ví dụ mới nhưng suy ra được từ quy tắc hoặc ví dụ của slide.
- Câu không có căn cứ rõ ràng được loại bỏ, không đưa vào ngân hàng A/B.
- Việc đánh giá nội dung *đúng theo C chuẩn hiện đại* là quy trình khác, không thay thế slide đã giảng.
