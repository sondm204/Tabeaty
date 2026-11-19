# NoteScape

NoteScape thay trang Tab mới của Chromium bằng bảng ghi chú nổi, đồng hồ tiếng Việt, thời tiết và lối tắt. Giao diện và ghi chú đã lưu mở được khi ngoại tuyến. Ảnh nền được tải từ Picsum và đổi sau khoảng 5 phút hoặc khi bấm **Đổi hình nền**. Bạn có thể kéo ghi chú bằng thanh tiêu đề, đổi kích thước ở cạnh hoặc góc và chỉnh màu, độ đậm nền, cỡ chữ qua biểu tượng bảng màu.

- **Workspace**. Mở menu cạnh logo để tạo, đổi tên và chuyển giữa tối đa ba workspace. Mỗi workspace có ghi chú, lối tắt, cài đặt và bố cục riêng. Dữ liệu của bản cũ nằm trong **Workspace 1**. Tab mới mở workspace bạn chọn gần nhất trên trình duyệt này.
- **Bố cục tiện ích**. Bật **Chỉnh bố cục tiện ích** để kéo từng thẻ Ngày giờ, Thời tiết, Countdown, Pomodoro và Lối tắt. Kéo góc để đổi kích thước hoặc bấm thùng rác trên thẻ để ẩn. Trong **Cài đặt → Tiện ích**, dùng checkbox trên tiêu đề để bật tắt từng widget và mở từng mục để chỉnh thêm. Mục **Ngày giờ** có chế độ ngày và giờ, chỉ giờ hoặc chỉ ngày. Mục **Ghi chú** cũng nằm tại đây.
- **Giữ tỷ lệ khi đổi màn hình**. Trên cửa sổ có bố cục bạn muốn giữ, vào **Cài đặt → Tiện ích** và bật **Giữ tỷ lệ bố cục**. NoteScape lưu kích thước cửa sổ đó cho workspace rồi thu phóng cả ghi chú và widget cùng nhau khi đổi màn hình. Muốn dùng kích thước chuẩn khác, tắt chế độ rồi bật lại trên cửa sổ mới.
- **Ghi chú và căn chỉnh**. Checkbox **Hiện ghi chú** trong **Cài đặt → Tiện ích** bật tắt bảng ghi chú và nút tạo ghi chú. Giữ **Shift** khi kéo ghi chú hoặc widget để căn tâm theo chiều ngang hoặc dọc của vùng hiển thị trình duyệt. Ghi chú cũng căn theo cạnh hoặc tâm của ghi chú khác khi kéo hoặc đổi kích thước. Thả chuột khi đường dóng hiện để lưu kết quả.
- **Ghi chú định dạng**. Bấm nút **Bật định dạng ghi chú** (biểu tượng chữ T) để mở trình soạn thảo với chữ đậm, nghiêng, danh sách gạch đầu dòng, danh sách đánh số và checklist có thể đánh dấu. Nội dung văn bản hiện tại được chuyển sang trình soạn thảo. Dữ liệu định dạng dùng chung hạn mức lưu trữ với nội dung.
- **Hẹn giờ**. Trong **Cài đặt → Tiện ích**, mở **Countdown** để bật thẻ và thêm tối đa ba mốc. Mở **Pomodoro** để bật riêng thẻ và đặt độ dài phiên tập trung/nghỉ. Pomodoro có nút bắt đầu, tạm dừng, tiếp tục, đặt lại và chuyển phiên. Khi hết giờ, bấm nút bắt đầu phiên kế tiếp. Đồng hồ dựa trên mốc thời gian đã lưu để tính thời gian còn lại khi mở lại tab.

## Cài đặt và phát triển

Cần Node.js 22.12+ (nhánh 22) hoặc Node.js 24+, npm và Chrome hoặc Edge bản hiện hành. Dự án dùng WXT, React, TypeScript, Tailwind CSS, react-rnd, Tiptap, Lucide React và Vitest.

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

Tên và dữ liệu workspace cũng được đồng bộ. Các workspace dùng chung hạn mức dung lượng Chrome Sync. **Xuất JSON** và **Nhập JSON** áp dụng cho workspace đang mở.

Thay đổi được gộp sau khoảng 2 giây ngừng chỉnh sửa. Các tab lắng nghe sự kiện thay đổi và áp dụng phiên bản hợp lệ mới hơn theo dấu thời gian, dùng mã phiên ghi để phân xử khi trùng thời gian. Bản sửa chưa lưu được giữ trong tab khi nhận cập nhật xung đột, kể cả thao tác xóa. Người dùng chọn phiên bản cần giữ. Chromium xử lý việc phân phối giữa máy và có thể nhận hai lần ghi gần như đồng thời trước khi NoteScape thấy xung đột.

Chrome giới hạn khoảng 8 KB mỗi mục, 100 KB tổng dung lượng, 512 mục và tốc độ ghi theo phút/giờ. NoteScape kiểm tra dung lượng theo UTF-8 với khoảng dự phòng. Nếu Chrome từ chối ghi, bạn có thể rút ngắn nội dung, xóa bớt mục, thử lại hoặc xuất bản đang mở. Bản nháp trong tab hỗ trợ khôi phục khi tải lại chính tab đó nếu trình duyệt còn giữ phiên. Với nội dung quan trọng chưa lưu được, dùng **Cài đặt → Tiện ích → Ghi chú → Xuất JSON** trước khi đóng tab. Nhập JSON kiểm tra dữ liệu và dung lượng riêng của tệp, cập nhật ghi chú trùng ID, giữ ghi chú khác và áp dụng cài đặt cùng lối tắt trong tệp.

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
- [ ] Giữ Shift khi kéo hoặc đổi kích thước gần cạnh hay tâm của ghi chú khác. Kiểm tra đường dóng, vị trí sau khi thả và thao tác nhả Shift giữa chừng.
- [ ] Bật trình soạn thảo trên ghi chú văn bản, áp dụng đậm/nghiêng và đánh dấu một việc trong checklist rồi tải lại.
- [ ] Đổi màu nền, màu chữ, độ đậm và cỡ chữ. Khóa vị trí rồi kiểm tra nội dung vẫn chỉnh được. Thử hủy và xác nhận xóa.
- [ ] Dừng chỉnh sửa vài giây, rồi tải lại tab và khởi động lại trình duyệt. Đối chiếu nội dung, kích thước và cài đặt.
- [ ] Thử ở 1366×768, 1440×900, 1920×1080 và thu nhỏ cửa sổ. Kiểm tra các nút trên ghi chú còn truy cập được.
- [ ] Đổi ảnh bằng tay, đợi khoảng 5 phút rồi thử đưa tab xuống nền và quay lại sau khi quá hạn. Thử khi mất mạng để kiểm tra ảnh hiện tại hoặc nền chuyển sắc.
- [ ] Đổi thành phố, kiểm tra nhiệt độ, độ ẩm và ba ngày dự báo. Tắt rồi bật lại widget, thử **Tải lại thời tiết** nếu kết nối bị gián đoạn.
- [ ] Trong **Cài đặt → Tiện ích**, mở và thu gọn từng mục, bật tắt từng widget và đổi màu. Kéo thẻ, đổi kích thước từ góc và thử ẩn bằng thùng rác. Tải lại để kiểm tra cài đặt đã lưu.
- [ ] Tắt rồi bật lại **Hiện ghi chú**, sau đó giữ Shift khi kéo ghi chú và widget đến gần tâm cửa sổ. Đối chiếu vị trí với đường dóng ngang và dọc.
- [ ] Bật **Giữ tỷ lệ bố cục** ở một cửa sổ ngang, đổi sang cửa sổ hẹp hoặc dọc rồi đối chiếu khoảng cách giữa ghi chú và widget. Tải lại tab và thử kéo ghi chú trong bố cục đã thu nhỏ.
- [ ] Thêm ba mốc Countdown, sửa hoặc xóa một mốc, rồi thử ẩn và bật lại thẻ. Bắt đầu, tạm dừng và tiếp tục Pomodoro, sau đó kiểm tra thời gian còn lại khi tải lại tab.
- [ ] Tạo hai workspace mới, thử đổi tên và xác nhận giới hạn ba workspace. Chuyển qua lại khi có ghi chú và cài đặt khác nhau, rồi tải lại tab.
- [ ] Thêm, sửa, đổi thứ tự, xóa và bấm mở lối tắt. Thử URL có giao thức không được hỗ trợ.
- [ ] Xuất và nhập JSON, sau đó thử nhập tệp sai định dạng.
- [ ] Mở hai tab, chỉnh cùng ghi chú để kiểm tra cập nhật và xung đột. Xóa ở một tab rồi đối chiếu tab kia.
- [ ] Cài cùng bản trên hai máy dùng cùng trình duyệt và tài khoản. Bật đồng bộ, tạo ghi chú, đổi thành phố, rồi kiểm tra dữ liệu khi trình duyệt chuyển thay đổi sang máy còn lại.
