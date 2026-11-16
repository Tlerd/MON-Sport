---
style: ste80
lang: vi
---

# F-036: Lớp công cụ MCP cho vai trò người dùng

Status: draft
Source: `docs/requirements/intake-monsport-v2.md` (mục W7, UC-20, BR-58). ADR 0008. `docs/design/ke-hoach-mcp.md` (bước 2). Người dùng ngày 16/11/2026: "Bắt đầu port app mobile cho W1, làm phần dọn dẹp, nếu được làm MCP, chạy verify-flow." (`HUMAN_DECISIONS.md`, dòng 26).

## Goal

Một module `mcp` trong API đưa 9 công cụ cho vai trò người dùng. Mỗi công cụ gọi service hiện có và không chép luật. Một yêu cầu đặt sân qua công cụ chạy đúng như `POST /api/bookings`. Bước này không có xác thực ngoài, không có đường HTTP và không đổi schema, nên chưa ai gọi được công cụ từ bên ngoài. Kiểm tra bằng test API qua một client MCP trong cùng tiến trình.

## Non-goals

| Non-goal | Why it is out | When it comes back |
|---|---|---|
| Đường HTTP `/mcp`, OAuth, metadata OAuth | Bước 4 của kế hoạch. Cần brief riêng và `rule-review` | Brief bước 4 |
| PAT, bảng token, lệnh stdio | Bước 3. Đổi schema, cần reviewer mạnh nhất | Brief bước 3 |
| Công cụ cho chủ sân, nhân viên, admin | `HUMAN_DECISIONS.md`, dòng 27. Mặc định: không | Khi bạn cần |
| `lat`, `lng`, `radiusKm` của `search_venues` | Cần tọa độ trên `Venue` (bước 1b, đổi schema) | Brief GPS |
| Duyệt hay từ chối yêu cầu vào trận, chấm điểm, xem hàng chờ | Plan chỉ liệt kê 9 công cụ. Hàng chờ có số điện thoại (BR-20) | Khi bạn cần |
| Giới hạn tần suất dùng chung giữa các instance | Bước này đếm trong bộ nhớ. Bước 3 chuyển sang `AuthThrottle` trước khi mở đường HTTP | Brief bước 3 |
| Deploy và nối thử bằng connector của Claude | Bước 5. Người dùng chạy, vì cần tài khoản của họ | Bước 5 |
| Màn "Tôi" cho kết nối AI | Cần PAT hoặc OAuth | Brief bước 3 và 4 |

## Research

Kiểm ngày 16/11/2026. Kế hoạch yêu cầu kiểm đặc tả và SDK trước brief đầu tiên.

| Điểm | Kết quả | Nguồn |
|---|---|---|
| Đặc tả hiện hành | Bản `2026-07-28`. Bản trước là `2025-11-25`. Yêu cầu không giữ trạng thái, mỗi request tự mang khả năng của nó | https://modelcontextprotocol.io/specification/latest |
| Gói SDK | `@modelcontextprotocol/server` **2.4.0**, phát hành 23/10/2026 (24 ngày trước ngày kiểm). Dòng v2 là bản ổn định hiện tại. Dòng v1.x (`@modelcontextprotocol/sdk` 1.32.2) chỉ còn sửa lỗi, và không hỗ trợ bản đặc tả `2026-07-28` | https://github.com/modelcontextprotocol/typescript-sdk (README của nhánh `v1.x`), https://www.npmjs.com/package/@modelcontextprotocol/server |
| Phiên bản ghim | Ghim đúng `2.4.0`, không dùng `^`. Test dùng thêm `@modelcontextprotocol/client` **2.4.0** (devDependency, cho `Client` và `InMemoryTransport`). Bước 4 sẽ thêm `@modelcontextprotocol/node` 2.1.2 (23/10/2026) nếu cần | npm registry, ngày phát hành của từng gói |
| Đăng ký công cụ | `server.registerTool(name, { title, description, inputSchema, outputSchema, annotations }, handler)`. `inputSchema` và `outputSchema` là `z.object(...)` của Zod (v1 dùng một shape thường). Một schema cho ra JSON Schema, kiểm tham số và kiểu của handler. Tham số sai trả `isError: true` và handler không chạy. Handler trả `content` (một khối `text`) và `structuredContent`. SDK kiểm `structuredContent` theo `outputSchema` trước khi gửi | https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/docs/servers/tools.md |
| Chú thích | `annotations: { readOnlyHint, destructiveHint, idempotentHint }`. Chúng chỉ là gợi ý cho client, không đổi cách chạy. Đặc tả coi chú thích là dữ liệu chưa tin cậy, nên server không dựa vào chúng để bảo vệ | cùng trang trên, và https://modelcontextprotocol.io/specification/latest |
| Zod | `@modelcontextprotocol/server` 2.4.0 phụ thuộc `zod ^4.2.0`, và đọc schema qua Standard Schema. Repo dùng `zod` 4.6.7, nên hai bản Zod khác nhau vẫn chạy được. AC-2 kiểm `inputSchema` thật sự có mặt | https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/docs/advanced/schema-libraries.md |
| Streamable HTTP | Một đường `/mcp` nhận POST (bắt buộc) và GET (có thể trả 405). Server phải kiểm `Origin` và nên có xác thực. Phiên (`MCP-Session-Id`) là tùy chọn. Chế độ không phiên: `NodeStreamableHTTPServerTransport({ sessionIdGenerator: undefined })` (gói `@modelcontextprotocol/node`) với một server và một transport cho mỗi request. Bản v2 còn có `createMcpHandler(buildServer)` cho `fetch` chuẩn web. Chọn giữa hai cách này ở brief bước 4 | https://modelcontextprotocol.io/specification/2025-11-25/basic/transports, https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/packages/middleware/node/README.md |
| stdio | `StdioServerTransport` từ `@modelcontextprotocol/server/stdio` (subpath, không nằm ở gốc gói). Server không được ghi gì ngoài thông điệp MCP ra `stdout`. Log đi vào `stderr`. v2 còn có `serveStdio(buildServer)` | https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/docs/migration/upgrade-to-v2.md, https://modelcontextprotocol.io/specification/2025-11-25/basic/transports |
| Test trong tiến trình | `InMemoryTransport.createLinkedPair()` nối một `Client` với một `McpServer` mà không mở cổng. Hai nửa của một cặp phải lấy từ cùng một gói | https://github.com/modelcontextprotocol/typescript-sdk/blob/v2.4.0/docs/testing.md |
| Cloud Run | **Hợp.** Chế độ không phiên không giữ trạng thái trong bộ nhớ. Cloud Run chạy tối đa 2 instance và chỉ hứa "session affinity" theo cách tốt nhất có thể (ADR 0005), nên không được dùng phiên trong bộ nhớ. Công cụ trả JSON một lần, không cần SSE nên không giữ kết nối dài. Thời gian chờ mặc định của request là 5 phút (tối đa 60 phút). `--no-cpu-throttling` đã bật từ ADR 0005, nên CPU luôn được cấp. Mô-đun dùng chung `PrismaService`, không mở kết nối mới, nên phép tính kết nối của ADR 0005 (tối đa 20 trên 25) không đổi. Trang tài liệu Cloud Run mà agent đọc chỉ nói về WebSocket, không xác nhận SSE, nên thiết kế không dựa vào SSE. Bước 4 phải thử thật trên bản live | https://docs.cloud.google.com/run/docs/triggering/websockets, `docs/adr/0005-thong-bao-web-push.md` |

## Acceptance criteria

Each criterion has one test. The test name starts with the label, for example `AC-1`.

Các test API dùng cơ sở dữ liệu thật như các test e2e hiện có, đồng hồ giả (`Clock`) và một `Client` MCP nối với server qua `InMemoryTransport`. "Công cụ gọi service" nghĩa là test đặt spy lên method của service và thấy đúng một lần gọi với đúng tham số.

- AC-1: `packages/shared/src/mcp.ts` có `MCP_TOOL_NAMES` với đúng 9 tên: `search_venues`, `get_availability`, `request_booking`, `list_my_bookings`, `cancel_booking`, `list_matches`, `open_match`, `join_match`, `leave_match`. Mọi schema đầu vào là `.strict()`. `RequestBookingInput` từ chối khóa thừa `userId`. `GetAvailabilityInput` từ chối `date` là "2026-13-40". `SearchVenuesInput` từ chối `sport` là "TENNIS" và `name` dài 101 ký tự. `JoinMatchInput` từ chối `matchId` là "abc".
- AC-2: Với `McpContext` vai trò `USER`, `tools/list` trả đúng 9 công cụ. Mỗi công cụ có `inputSchema` (JSON Schema) và `outputSchema`. Công cụ ghi (`request_booking`, `cancel_booking`, `open_match`, `join_match`, `leave_match`) có `destructiveHint: true` và `readOnlyHint: false`. Công cụ đọc có `readOnlyHint: true`. Mỗi kết quả có `structuredContent` hợp lệ theo `outputSchema`, và `content` có đúng một khối `text` bằng `JSON.stringify(structuredContent)`. Không công cụ nào trả chuỗi tự do ngoài các trường của hợp đồng.
- AC-3: Với `McpContext` vai trò `OWNER`, `STAFF` hoặc `ADMIN`, `tools/list` trả mảng rỗng. Gọi `request_booking` bằng ngữ cảnh đó trả lỗi "công cụ không tồn tại", và `BookingsService.request` không được gọi (BR-22).
- AC-4: `search_venues` với `{ sport: "FOOTBALL", name: "an" }` gọi service tìm đơn vị của module `venues`. Kết quả gồm các đơn vị có ít nhất một sân FOOTBALL. Tên đơn vị hoặc tên sân phải chứa "an", không phân biệt hoa thường. Xếp theo tên tăng dần. Mỗi đơn vị kèm mọi sân của nó. Mỗi phần tử có đúng các khóa của `VenueView`. Trong chuỗi JSON của kết quả không có tên hay số điện thoại của chủ sân (test đặt chủ sân tên "Chu San Rieng", số "0900000001"), và không có `ownerId`. Không có tham số thì kết quả bằng `GET /api/venues`.
- AC-5: `get_availability` với `{ courtId, date: "2026-12-01" }` trả đúng nội dung của `GET /api/courts/:id/availability?date=2026-12-01` cho cùng sân. Sân không có trong DB trả lỗi công cụ "Không tìm thấy sân". Ngày đã qua trả `free` rỗng.
- AC-6: `request_booking` gọi `BookingsService.request` đúng một lần với `(userId, input)`. Sân có `priceNormal` 100000 và `pricePeak` 150000, giờ mở cửa 06:00 đến 23:00, giờ giả 2026-11-20 10:00 (giờ Việt Nam). Yêu cầu 2026-12-01 18:00 đến 19:30 tạo một booking `PENDING`, nguồn `APP`, `priceTotal` 225000 (BR-5, BR-6) và `confirmDeadline` 2026-11-20T05:00:00Z (BR-7). Kết quả có `booking`, `venueName`, `courtName`, `venuePhone` (số công khai của đơn vị, vd. "0281234567") và `message` có dạng "Yêu cầu đang chờ chủ sân xác nhận. Hạn xác nhận: 12:00 20/11 (giờ Việt Nam). Gọi chủ sân: 0281234567" (UC-2, UC-3). Sau đó `get_availability` không còn liệt kê khung giờ đó là trống (hold PENDING).
- AC-7: Ba yêu cầu sai trả cùng thông báo như `POST /api/bookings` với cùng đầu vào: giờ bắt đầu 17:15 trả "Giờ phải theo bước 30 phút" (BR-2). Khung 18:00 đến 18:30 trả "Mỗi booking dài ít nhất 1 giờ" (BR-3). Giờ bắt đầu 2026-11-20 10:30 khi giờ giả là 2026-11-20 10:00 trả "Đã quá hạn đặt trong app. Hãy gọi chủ sân" (BR-9). Không booking nào được tạo.
- AC-8: 5 người dùng khác nhau gọi `request_booking` cùng lúc cho cùng sân và cùng khung giờ. Đúng một lời gọi thành công. Bốn lời gọi còn lại trả lỗi công cụ "Khung giờ này vừa có người đặt". Bảng `Booking` có đúng một dòng active cho khung đó (BR-1, BR-6). Test này đi qua `BookingsService.request`, cùng thứ tự khóa `Venue` rồi `Court` như `POST /api/bookings`.
- AC-9: `list_my_bookings` của người dùng A (có 2 booking) trả đúng 2 booking đó, bằng nội dung `GET /api/bookings/mine`, và không trả booking của người dùng B (có 1 booking). Kết quả không có khóa `customerPhone` hay `customer`. `cancel_booking` booking `PENDING` của A trả booking `CANCELLED` có `cancelledAt` khác rỗng (BR-12). Booking `CONFIRMED` còn 5 giờ tới giờ bắt đầu trả lỗi "Còn dưới 6 giờ nữa tới giờ bắt đầu. Hãy gọi chủ sân" và vẫn `CONFIRMED` (BR-11).
- AC-10: Người dùng A gọi `cancel_booking` với `bookingId` của B nhận lỗi "Không tìm thấy booking", đúng như khi dùng một UUID không tồn tại. Booking của B giữ nguyên. A gọi `open_match` với `bookingId` của B nhận lỗi "Không tìm thấy booking" và bảng `Match` không có dòng mới. A gọi `join_match` hoặc `leave_match` với trận không có trong DB nhận lỗi "Không tìm thấy trận". Không lời gọi nào trả tên hay số điện thoại của B (BR-20).
- AC-11: `list_matches` với `{ sport: "FOOTBALL" }` trả cùng danh sách như `GET /api/matches?sport=FOOTBALL`. Mỗi phần tử có `hostName` và không có số điện thoại. `open_match` trên booking `CONFIRMED` của chính A với `{ capacity: 10, pricePerSlot: 50000, joinMode: "APPROVAL" }` tạo một trận `OPEN` có `joinedCount` 1 (host, BR-14) và `joinMode` "APPROVAL". Gọi lần hai trên cùng booking trả lỗi giống `POST /api/matches`. `capacity` 1 bị từ chối với "Số suất từ 2 đến 30".
- AC-12: Người dùng C gọi `join_match` vào trận `INSTANT` của A (sức chứa 10, đã có 1 người): kết quả có `joinedCount` 2, `viewerRole` "PLAYER", và mọi `players[].phone` là `null` (BR-20). Gọi lần hai trả "Bạn đã ở trong trận này". `leave_match` đưa `joinedCount` về 1. Host A gọi `leave_match` trả "Host không rời trận được. Hãy hủy trận". Trận sức chứa 2 đã có host: hai người dùng gọi `join_match` cùng lúc, một người có suất và người kia nhận "Trận đã đủ người" (BR-15).
- AC-13: Giờ giả không đổi. Người dùng A gọi 10 công cụ ghi liên tiếp. Công cụ ghi thứ 11 trong cùng phút trả lỗi "Quá nhiều lệnh. Thử lại sau" và service không được gọi (BR-58). Người dùng B vẫn gọi được. Sau khi giờ giả tăng 61 giây, A gọi lại được. Với công cụ đọc, lời gọi thứ 61 trong một phút trả cùng lỗi. Lệnh bị từ chối vẫn được đếm.
- AC-14: Ứng dụng Nest đầy đủ (`AppModule` có `McpModule`) không có route nào của module `mcp`. `POST /api/mcp`, `GET /api/mcp`, `POST /mcp` và `GET /mcp` trả 404 với cookie phiên hợp lệ. Thư mục `apps/api/prisma/` và `apps/api/prisma/migrations/` không có thay đổi nào so với `main`. Test kiểm vế đầu. Reviewer kiểm vế sau bằng `git diff --stat main -- apps/api/prisma`.

## Contract

`packages/shared/src/mcp.ts`, xuất qua `packages/shared/src/index.ts`:

```ts
export const MCP_TOOL_NAMES = [
  'search_venues', 'get_availability', 'request_booking', 'list_my_bookings', 'cancel_booking',
  'list_matches', 'open_match', 'join_match', 'leave_match',
] as const;
export type McpToolName = (typeof MCP_TOOL_NAMES)[number];
export const MCP_WRITE_TOOLS = ['request_booking', 'cancel_booking', 'open_match', 'join_match', 'leave_match'] as const;

// Đầu vào. Dùng lại schema hiện có khi có. Mọi schema là .strict().
export const SearchVenuesInput = z.object({ sport: Sport.optional(), name: z.string().trim().min(1).max(100).optional() }).strict();
export const GetAvailabilityInput = AvailabilityQuery.extend({ courtId: z.uuid() }).strict();
export const RequestBookingInput = CreateBookingRequest.strict();
export const ListMyBookingsInput = z.object({}).strict();
export const CancelBookingInput = z.object({ bookingId: z.uuid() }).strict();
export const ListMatchesInput = MatchLobbyQuery;
export const OpenMatchInput = CreateMatchRequest;
export const JoinMatchInput = z.object({ matchId: z.uuid() }).strict();
export const LeaveMatchInput = JoinMatchInput;

// Đầu ra. structuredContent luôn là một object, nên danh sách nằm trong một khóa.
export const SearchVenuesOutput = z.object({ venues: z.array(VenueView) });
export const GetAvailabilityOutput = Availability;
export const RequestBookingOutput = z.object({
  booking: BookingView,
  venueName: z.string(),
  courtName: z.string(),
  venuePhone: Phone,
  message: z.string(),
});
export const ListMyBookingsOutput = z.object({ bookings: z.array(MyBookingView) });
export const CancelBookingOutput = z.object({ booking: MyBookingView });
export const ListMatchesOutput = z.object({ matches: z.array(MatchView) });
export const OpenMatchOutput = z.object({ match: MatchView });
export const JoinMatchOutput = z.object({ match: MatchDetailView });
export const LeaveMatchOutput = JoinMatchOutput;
```

Ghi chú: `GetAvailabilityInput` dùng `AvailabilityQuery.extend`, và `AvailabilityQuery` đã `.strict()`. Nếu `.extend` trên schema strict không giữ `strict`, thêm `.strict()` lại. `message` của `RequestBookingOutput` là dữ liệu do server sinh, không chứa chuỗi tự do của người dùng khác.

`apps/api/src/modules/mcp/`:

```ts
export interface McpContext { userId: string; role: Role }   // bước sau: PAT hoặc OAuth tạo McpContext

@Injectable()
export class McpService {
  // Trả một McpServer mới cho ngữ cảnh này. Vai trò khác USER nhận server không có công cụ.
  createServer(ctx: McpContext): McpServer;
}
```

- Công cụ gọi `BookingsService.request`, `.mine`, `.cancelOwn`, `MatchesService.list`, `.create`, `.join`, `.leave`. Với `search_venues` và `get_availability`, bước 2 của build order tách phần đọc của `VenuesController` và `AvailabilityController` thành `VenuesService.search` và `AvailabilityService.get`. Hai controller gọi lại hai service đó. Hành vi của hai route không đổi.
- `request_booking` đọc `court.name`, `venue.name` và `venue.phone` bằng một `select` chỉ-đọc sau khi `request` trả về. Đây là dữ liệu công khai của đơn vị, như `GET /api/venues`.
- Lỗi của service (`HttpException`) thành kết quả `isError: true` với `text` là đúng thông báo của exception. Lỗi khác trả "Có lỗi xảy ra. Thử lại sau" và ghi log phía server, không kèm chi tiết.
- Bộ đếm BR-58 nằm trong `McpService`: cửa sổ cố định 60 giây theo `userId` và `Clock`, 60 lệnh tổng và 10 lệnh ghi. Lệnh bị từ chối vẫn được đếm. Bộ đếm nằm trong bộ nhớ của instance. Brief bước 3 chuyển nó sang `AuthThrottle` trước khi mở đường HTTP.
- `McpModule` không có controller. Nó xuất `McpService`. `AppModule` import nó.
- Mô tả công cụ ghi nêu rõ hậu quả bằng tiếng Việt, ví dụ `request_booking`: "Gửi yêu cầu đặt sân. Chủ sân phải xác nhận trước hạn, nếu không yêu cầu hết hạn. Không thu tiền". Plan yêu cầu mô tả này để client hỏi người dùng trước khi chạy. `destructiveHint: true` đặt cho cả năm công cụ ghi theo plan, kể cả khi đặc tả chỉ dùng nó cho thao tác phá hủy.

`packages/client/src/mcp.ts`: xuất lại kiểu của đầu vào và đầu ra (`z.infer`) và `MCP_TOOL_NAMES`, cho màn "Tôi" ở bước sau.

## Data

Không đổi schema. Không migration. Không đổi `docs/requirements/data-dictionary.md`. Ghi `BR-58`, `UC-20` đã nằm trong `business-rules.md` và `use-cases.md` (cùng PR của brief này).

## Lock order

Công cụ không thêm khóa nào. `request_booking` đi qua `BookingsService.request`: `Venue` (FOR SHARE), rồi `Court` (FOR UPDATE). `join_match` và `leave_match` đi qua `MatchesService` với khóa của chúng (BR-15). Module `mcp` không mở transaction và không ghi bảng nào bằng Prisma.

## Build order

One pull request for each row. Each pull request passes the check command on its own.

| # | Pull request | Paths | Tests |
|---|---|---|---|
| 1 | Contract | `packages/shared/src/mcp.ts`, `packages/shared/src/mcp.test.ts`, `packages/shared/src/index.ts`, `packages/client/src/mcp.ts`, `packages/client/src/index.ts`, `PROGRESS.md`, `@map.md` | AC-1 |
| 2 | Tool layer | `apps/api/src/modules/mcp/`, `apps/api/src/modules/venues/venues.service.ts`, `apps/api/src/modules/venues/availability.service.ts`, `apps/api/src/modules/venues/venues.controller.ts`, `apps/api/src/modules/venues/availability.controller.ts`, `apps/api/src/modules/venues/venues.module.ts`, `apps/api/src/modules/bookings/bookings.module.ts`, `apps/api/src/modules/matches/matches.module.ts`, `apps/api/src/app.module.ts`, `apps/api/package.json`, `pnpm-lock.yaml`, `PROGRESS.md`, `HUMAN_DECISIONS.md`, `@map.md` | AC-2 đến AC-14 |

Lưu ý bước 2:

- Thêm `@modelcontextprotocol/server` đúng `2.4.0` vào `dependencies` và `@modelcontextprotocol/client` đúng `2.4.0` vào `devDependencies` của `apps/api`. Không dùng `^`.
- Sửa `bookings.module.ts` và `matches.module.ts` chỉ để thêm `exports`. Sửa `venues.module.ts` để đăng ký hai service mới và xuất chúng. Không đổi logic trong các service của `bookings` và `matches`.
- Việc tách service của `venues` không đổi hành vi. Test e2e hiện có của `GET /api/venues` và `GET /api/courts/:id/availability` phải pass không sửa.
- Kiểm bằng `pnpm check`: luật import (`.dependency-cruiser.cjs`) phải cho phép `mcp` import service của `bookings`, `venues` và `matches`. Nếu không, thêm luật cho `mcp` trong cùng PR và nói rõ trong mô tả PR.

## Edit boundaries

- May edit: các đường dẫn trong "Build order", đúng bước của chúng.
- Leave unchanged without approval: `apps/api/prisma/` (schema và migration), `apps/web/`, `apps/mobile/`, `apps/api/src/modules/bookings/bookings.service.ts`, `apps/api/src/modules/matches/matches.service.ts`, `apps/api/src/modules/auth/`, `apps/api/src/modules/finance/`, các migration đã có, `DESIGN.md`, `REVIEW.md`.

## Risks and reviews

| Risk | Where | Control |
|---|---|---|
| Đồng thời: đặt sân và vào trận qua công cụ | Bước 2 | Công cụ không mở transaction, chỉ gọi service. AC-8 và AC-12. Review bằng model mạnh nhất và skill `rule-review` |
| Quyền: người dùng A chạm vào dữ liệu của B | Bước 2 | `userId` lấy từ `McpContext`, không từ đầu vào. Đầu vào `.strict()` từ chối `userId`. AC-1, AC-10 |
| Dữ liệu cá nhân: số điện thoại, tên | Bước 2 | `search_venues` chỉ trả `VenueView`. Công cụ trận không trả số điện thoại cho người chơi. AC-4, AC-9, AC-12 |
| Lệnh chèn qua tên sân hoặc tên host (prompt injection) | Bước 2 | Kết quả có cấu trúc, không gộp chuỗi của người khác vào `message`. AC-2 |
| Quá nhiều lệnh từ một AI | Bước 2 | BR-58, AC-13. Bước 3 chuyển bộ đếm sang `AuthThrottle` trước khi mở đường HTTP |
| Mở đường vào từ bên ngoài ngoài ý muốn | Bước 2 | `McpModule` không có controller. AC-14 |
| Phụ thuộc mới | Bước 2 | Ghim đúng phiên bản. Reviewer kiểm `pnpm-lock.yaml` chỉ thêm các gói của `@modelcontextprotocol` và phụ thuộc của chúng |
| Schema: không đổi | Bước 2 | AC-14, `git diff --stat main -- apps/api/prisma` rỗng |

## Assumptions

| Assumption | Why |
|---|---|
| Dùng SDK v2 (`@modelcontextprotocol/server` 2.4.0), không dùng v1.x | v2 là bản ổn định hiện tại và hỗ trợ đặc tả `2026-07-28`. v1.x chỉ còn sửa lỗi |
| `destructiveHint: true` cho cả năm công cụ ghi | Plan yêu cầu để client hỏi người dùng trước khi chạy |
| Bộ đếm BR-58 nằm trong bộ nhớ ở bước này (60 lệnh, 10 lệnh ghi mỗi phút) | Chưa có đường HTTP nên chưa có rủi ro giữa các instance. Giá trị là giả định, chờ bạn sửa (intake V2, mục "Open items", dòng 5) |
| `search_venues` lọc theo tên đơn vị hoặc tên sân, phần chứa, không phân biệt hoa thường | UC-2 dòng 2.1 cho tìm theo tên sân |
| Tách `VenuesService` và `AvailabilityService` ra khỏi hai controller | Cách duy nhất để công cụ gọi cùng mã mà không chép luật. Hành vi không đổi |
| Đọc số điện thoại đơn vị bằng một `select` chỉ-đọc trong module `mcp` | `BookingView` không có số điện thoại. Đổi `BookingsService.request` nằm ngoài đường dẫn cho phép |
| Lời gọi bị SDK từ chối vì sai schema không được đếm vào BR-58 | SDK từ chối trước khi handler chạy, nên bộ đếm không thấy lời gọi. Bước 3 có thể chuyển việc đếm lên sớm hơn |
| Công cụ chạy với mọi booking nguồn `APP` của người dùng. Booking nguồn `PHONE` trả như không tồn tại | Giống `cancelOwn` hiện có |

## Open questions

| Question | Owner | Blocks |
|---|---|---|
| Giới hạn BR-58: 60 lệnh và 10 lệnh ghi mỗi phút. Mặc định: như vậy | Bạn | none |
| Công cụ cho chủ sân và admin (dòng 27). Mặc định: không | Bạn | none |
| Màn "Cho phép" của connector nêu dữ liệu cá nhân nào AI đọc (BR-29, câu hỏi 4) | Bạn | Bước 4 |

## Done when

- Every AC has a passing test with its label in the name.
- The check command passes on the last pull request.
- The reviews in "Risks and reviews" are complete.
- `git diff --stat main -- apps/api/prisma` is empty.
