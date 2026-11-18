# NoteScape

NoteScape thay trang Tab mới của Chromium bằng bảng ghi chú nổi, đồng hồ tiếng Việt, thời tiết và lối tắt. Giao diện và ghi chú đã lưu mở được khi ngoại tuyến. Ảnh nền được tải từ Picsum và đổi sau khoảng 5 phút hoặc khi bấm **Đổi hình nền**. Bạn có thể kéo ghi chú bằng thanh tiêu đề, đổi kích thước ở cạnh hoặc góc và chỉnh màu, độ đậm nền, cỡ chữ qua biểu tượng bảng màu.

Trong **Cài đặt → Tiện ích**, bạn có thể đổi màu chữ, kích thước và vị trí ngang/dọc của ngày giờ và thời tiết. Thẻ thời tiết còn có màu và độ đậm nền riêng. Khi sắp xếp ghi chú, giữ **Shift** trong lúc kéo để căn theo cạnh hoặc tâm của ghi chú khác và vùng làm việc. Thả chuột khi đường dóng hiện để lưu vị trí đã căn.

## Cài đặt và phát triển

Cần Node.js 22.12+ (nhánh 22) hoặc Node.js 24+, npm và Chrome hoặc Edge bản hiện hành. Dự án dùng WXT, React, TypeScript, Tailwind CSS, react-rnd, Lucide React và Vitest.

```bash
npm ci
npm run dev
```

| Lệnh | Chức năng |
| --- | --- |
| `npm run dev` | Chạy WXT với chế độ phát triển và tải lại khi sửa mã |
| `npm run typecheck` | Tạo kiểu WXT và kiểm tra TypeScript |
| `npm test` | Chạy các bài kiểm thử Vitest |
| `npm run build` | Tạo tiện ích Manifest V3 trong `.output/chrome-mv3/` |
| `npm run zip` | Build và đóng gói sản phẩm trong `.output/` |

### Cài bản unpacked trên Chrome hoặc Edge

1. Chạy `npm ci` và `npm run build`, hoặc giải nén tệp ZIP phát hành.
2. Trên Chrome mở `chrome://extensions`. Trên Edge mở `edge://extensions`.
3. Bật **Developer mode** / **Chế độ nhà phát triển**, rồi bấm **Load unpacked** / **Tải tiện ích đã giải nén**.
4. Chọn thư mục chứa `manifest.json`. Với bản build, thư mục là `.output/chrome-mv3`.
5. Mở một tab mới. Nếu Edge hỏi có giữ thay đổi trang Tab mới hay không, chọn giữ thay đổi.
6. Sau khi build lại, bấm nút **Reload** trên thẻ tiện ích rồi mở một tab mới.

## Lưu trữ và đồng bộ

NoteScape dùng `chrome.storage.sync` cho ghi chú, vị trí tương đối, kích thước, thứ tự lớp, cài đặt và lối tắt. Mỗi ghi chú được lưu dưới một khóa riêng. Để đồng bộ giữa hai máy, cài **cùng bản NoteScape có cùng ID tiện ích** trên cả hai máy, dùng cùng hệ trình duyệt và cùng tài khoản, rồi bật đồng bộ tiện ích và dữ liệu tiện ích trong trình duyệt. Bản unpacked có khóa công khai cố định để giữ cùng ID khi đổi đường dẫn cài đặt. Nếu phát hành qua cửa hàng với ID khác, dữ liệu của bản cài cũ có thể chuyển qua JSON. Chrome Sync và Edge Sync hoạt động riêng.

Thay đổi được gộp sau khoảng 2 giây ngừng chỉnh sửa. Trạng thái **Đã lưu trên trình duyệt** xác nhận bộ nhớ tại chỗ đã nhận thay đổi. Các tab lắng nghe sự kiện thay đổi và áp dụng phiên bản hợp lệ mới hơn theo dấu thời gian, dùng mã phiên ghi để phân xử khi trùng thời gian. Bản sửa chưa lưu được giữ trong tab khi nhận cập nhật xung đột, kể cả thao tác xóa. Người dùng chọn phiên bản cần giữ. Chromium xử lý việc phân phối giữa máy và có thể nhận hai lần ghi gần như đồng thời trước khi NoteScape thấy xung đột.

Chrome giới hạn khoảng 8 KB mỗi mục, 100 KB tổng dung lượng, 512 mục và tốc độ ghi theo phút/giờ. NoteScape kiểm tra dung lượng theo UTF-8 với khoảng dự phòng. Nếu Chrome từ chối ghi, bạn có thể rút ngắn nội dung, xóa bớt mục, thử lại hoặc xuất bản đang mở. Bản nháp trong tab hỗ trợ khôi phục khi tải lại chính tab đó nếu trình duyệt còn giữ phiên. Với nội dung quan trọng chưa lưu được, dùng **Cài đặt → Ghi chú → Xuất JSON** trước khi đóng tab. Nhập JSON kiểm tra dữ liệu và dung lượng riêng của tệp, cập nhật ghi chú trùng ID, giữ ghi chú khác và áp dụng cài đặt cùng lối tắt trong tệp.

## Dịch vụ bên ngoài

- [Picsum Photos](https://picsum.photos/) cung cấp ảnh nền. Ảnh được tải trước khi chuyển cảnh và lựa chọn chỉ tồn tại trong tab hiện tại.
- [Open-Meteo](https://open-meteo.com/en/docs) cung cấp thời tiết và dự báo. [Open-Meteo Geocoding](https://open-meteo.com/en/docs/geocoding-api) tìm tọa độ từ tên thành phố. Hai dịch vụ công khai này không cần khóa API cho quy trình sử dụng được triển khai.
- Lối tắt HTTPS có thể lấy `/favicon.ico` trực tiếp từ website tương ứng. Một biểu tượng tích hợp sẽ hiện khi trang thiếu favicon hoặc lượt tải thất bại.

Extension chỉ khai báo quyền `storage` và quyền truy cập hai máy chủ Open-Meteo. Nội dung ghi chú được gửi tới Chrome Sync theo cài đặt trình duyệt của người dùng. Picsum, Open-Meteo và các yêu cầu favicon không nhận nội dung ghi chú.

## Xử lý sự cố

| Triệu chứng | Cách kiểm tra |
| --- | --- |
| Tab mới chưa đổi | Kiểm tra tiện ích đang bật, đã chọn đúng thư mục `manifest.json`, và tiện ích thay Tab mới khác đang tắt |
| Không tải được ảnh | Bấm **Đổi hình nền** để thử lại. Khi lần tải đầu thất bại, nền chuyển sắc vẫn hiển thị |
| Thời tiết không tải hoặc không tìm được thành phố | Kiểm tra mạng cho hai máy chủ Open-Meteo hoặc thử một tên thành phố khác |
| Ghi chú chưa có trên máy thứ hai | Đối chiếu ID tiện ích, tài khoản và cài đặt đồng bộ. Thử kiểm tra lưu trên trình duyệt và mở hai tab cùng máy để chẩn đoán riêng |
| Không thể lưu | Kiểm tra thông báo, xuất JSON để giữ nội dung và rút ngắn ghi chú hoặc giải phóng dung lượng |
| Trình duyệt từ chối tải unpacked | Kiểm tra chính sách trình duyệt quản lý tại `chrome://policy` hoặc `edge://policy` |

## Checklist kiểm thử thủ công

- [ ] Cài unpacked, mở tab mới và kiểm tra đồng hồ, thứ và ngày.
- [ ] Tạo nhiều ghi chú. Viết nhiều dòng, chọn và dán văn bản. Kéo bằng tay nắm, kéo cạnh/góc để đổi kích thước và kiểm tra note lên lớp trên khi chọn.
- [ ] Giữ Shift khi kéo gần cạnh hoặc tâm của ghi chú khác. Kiểm tra đường dóng và vị trí sau khi thả, rồi thử nhả Shift giữa chừng để kéo tự do.
- [ ] Đổi màu nền, màu chữ, độ đậm và cỡ chữ. Khóa vị trí rồi kiểm tra nội dung vẫn chỉnh được. Thử hủy và xác nhận xóa.
- [ ] Tải lại tab và khởi động lại trình duyệt sau khi báo đã lưu. Đối chiếu nội dung, kích thước và cài đặt.
- [ ] Thử ở 1366×768, 1440×900, 1920×1080 và thu nhỏ cửa sổ. Kiểm tra các nút trên ghi chú còn truy cập được.
- [ ] Đổi ảnh bằng tay, đợi khoảng 5 phút rồi thử đưa tab xuống nền và quay lại sau khi quá hạn. Thử khi mất mạng để kiểm tra ảnh hiện tại hoặc nền chuyển sắc.
- [ ] Đổi thành phố, kiểm tra nhiệt độ, độ ẩm và ba ngày dự báo. Thử tên thành phố không tồn tại.
- [ ] Trong **Cài đặt → Tiện ích**, đổi màu, kích thước và vị trí của ngày giờ và thời tiết. Tải lại tab để kiểm tra cài đặt đã lưu rồi thử đặt lại cả hai.
- [ ] Thêm, sửa, đổi thứ tự, xóa và bấm mở lối tắt. Thử URL có giao thức không được hỗ trợ.
- [ ] Xuất và nhập JSON, sau đó thử nhập tệp sai định dạng.
- [ ] Mở hai tab, chỉnh cùng ghi chú để kiểm tra cập nhật và xung đột. Xóa ở một tab rồi đối chiếu tab kia.
- [ ] Cài cùng bản trên hai máy dùng cùng trình duyệt và tài khoản. Bật đồng bộ, tạo ghi chú, đổi thành phố, rồi kiểm tra dữ liệu khi trình duyệt chuyển thay đổi sang máy còn lại.
