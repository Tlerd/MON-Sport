# Nghiên cứu: ghép trận, đo trình độ, giải đấu và tìm sân theo vị trí

Ngày: 2026-11-20. Đây là tài liệu tham khảo, không phải yêu cầu. Intake vẫn là nguồn sự thật (`docs/adr/0002-nguon-su-that-intake.md`). Giải đấu, rating và tìm sân theo vị trí chưa có trong intake V1 và V2. Cần bổ sung intake và chốt luật trong `HUMAN_DECISIONS.md` trước khi viết brief.

## Kết luận ngắn

- Ghép người vào trận: MONSPORT hiện chưa cần thuật toán Hungary. Người chơi tự chọn trận trong Phòng chờ. Thứ cần là một hàm điểm phù hợp để sắp trận gợi ý.
- Đo trình độ: dùng một hệ rating Bayes cho đội, ví dụ OpenSkill (cùng họ với TrueSkill). Một thuật toán dùng được cho đánh đơn, đánh đôi và bóng đá theo đội.
- Giải đấu: tách 2 con số.
  - Rating đo sức mạnh. Dùng để ghép trận và xếp hạt giống.
  - Điểm xếp hạng (ranking) thưởng thành tích theo mùa, giống cách của BWF.
- Tìm sân trong bán kính 5–10 km: dùng công thức Haversine, hoặc `earthdistance` hay PostGIS trong Postgres. Bán kính tự nới khi có ít kết quả.

## 1. Thuật toán Hungary và ghép trận

Hungary (Kuhn–Munkres, gọi tắt KM) giải bài toán phân công. Có n người và n việc, mỗi cặp có một chi phí. Thuật toán tìm cách ghép 1–1 có tổng chi phí nhỏ nhất. Độ phức tạp là O(n³).

Grab dùng nó thế nào:

- Blog kỹ thuật của Grab coi việc ghép tài xế với khách là bài toán ghép hai phía có tổng chi phí nhỏ nhất, giải bằng KM.
- Bài báo PVLDB 2021 của Grab-NUS tăng tốc KM bằng cách chỉ tính chi phí khi cần (Incremental KM).
- Grab nói hệ thống thật xét hơn 40 yếu tố. Grab chưa công bố hệ thống thật có dùng đúng KM hay không.

Vì sao Grab cần mà MONSPORT chưa cần:

| Hungary có ích khi | Grab | MONSPORT hiện nay |
|---|---|---|
| Hệ thống trung tâm quyết định ai đi với ai | Có | Không. Người chơi tự chọn trận |
| Nhiều yêu cầu đến cùng lúc, ghép theo lô | Có, vài giây một lô | Ít yêu cầu, rải rác |
| Ghép 1–1 | Có | Không. Một trận có nhiều chỗ |
| Chi phí đo được rõ ràng | Có (thời gian đón khách) | Không rõ: trình độ, giờ, khu vực, sở thích |

Thay cho Hungary: hàm điểm phù hợp cho Phòng chờ. Tính điểm của từng trận đang mở cho mỗi người chơi, rồi sắp giảm dần:

```
fit = w1·trình_độ + w2·khoảng_cách + w3·giờ + w4·uy_tín

trình_độ     = 1 − |2p − 1|     p = xác suất người này thắng mặt bằng của trận
khoảng_cách  = exp(−d / 5 km)
giờ          = 1 khi trận nằm trong khung giờ người đó hay chơi, giảm dần khi lệch xa
uy_tín       = điểm uy tín F-032 / 100
```

`trình_độ` bằng 1 khi p = 0.5, tức là trận cân sức. TrueSkill có chỉ số tương tự gọi là "chất lượng trận": xác suất hai bên hòa theo mô hình. Ban đầu đặt trọng số w bằng tay. Sau đó chỉnh theo tỷ lệ người bấm "Tham gia".

Khi nào mới cần một thuật toán ghép thật sự:

| Tính năng sau này | Bài toán | Thuật toán |
|---|---|---|
| "Ghép nhanh": nhiều người bấm cùng lúc, hệ thống xếp họ vào chỗ trống | Ghép hai phía, mỗi trận nhiều chỗ | Hungary (mỗi chỗ trống là một cột) hoặc luồng chi phí nhỏ nhất (min-cost flow) |
| Ghép cặp đánh đôi từ một nhóm người lẻ | Ghép một phía | Edmonds blossom (ghép có tổng trọng số lớn nhất) |
| Chủ trận và người chơi đều có danh sách ưu tiên | Ghép ổn định | Gale–Shapley (deferred acceptance) |
| Chia 10–14 người đá phủi thành 2 đội cân bằng | Chia tập (partition) | Thử hết mọi cách: 10 người có 126 cách. Nhóm lớn hơn thì chia kiểu rắn (snake draft). Chọn cách chia có xác suất thắng gần 50% nhất, không chỉ so tổng rating |

## 2. Liên Quân và game MOBA ghép trận thế nào

Garena chưa công bố thuật toán ghép trận của Liên Quân. Liên Quân là bản quốc tế của Vương Giả Vinh Diệu (Honor of Kings, Tencent). Những gì có nguồn công khai:

- Honor of Kings: Wikipedia ghi game ghép người theo bậc rank và tỷ lệ thắng.
- Riot (Liên Minh Huyền Thoại) là nguồn công khai rõ nhất cho game MOBA.
  - Hệ thống cân 3 mục tiêu: trận công bằng, vị trí ưu tiên, hàng chờ nhanh.
  - Trận công bằng là trận hai đội có MMR trung bình tương đương. Mỗi đội có khoảng 50% ±1% cơ hội thắng.
  - Chờ càng lâu, hệ thống càng tìm xa mốc MMR của người chơi.
- Tencent, bài báo Cupid (2024): ghép xong 10 người rồi chia lại đội và vị trí, để trận cân hơn.
- EA, bài báo EOMM (2017): ghép để người chơi chơi tiếp lâu hơn, không chỉ để trận công bằng. Bước cuối dùng ghép cặp trọng số nhỏ nhất.

Khung chung của các game MOBA là vé chờ cộng cửa sổ nới dần:

```
Mỗi người hoặc nhóm vào hàng = 1 vé: {MMR, server, vị trí muốn, giờ vào hàng}
Chia hàng chờ theo server và chế độ chơi
Mỗi vài giây:
  lấy vé chờ lâu nhất
  W = W0 + a · thời_gian_chờ              cửa sổ nới dần
  gom đủ 10 người có |MMR − MMR_vé| ≤ W
  chia 2 đội: chênh MMR trung bình nhỏ nhất, đủ vị trí
  xác suất thắng dự đoán trong khoảng 50% ± x  → tạo trận, nếu không thì chờ tiếp
```

Áp vào MONSPORT:

| Liên Quân | MONSPORT |
|---|---|
| Server theo vùng (cho ping thấp) | Khu vực: quận, thành phố, hoặc ô lưới địa lý |
| MMR | Rating (OpenSkill) |
| Nới cửa sổ MMR khi chờ lâu | Nới bán kính 5 → 7.5 → 10 km, và nới mức chênh trình độ |
| Vị trí (đường giữa, đi rừng) | Vị trí trong đội (thủ môn), tay thuận khi đánh đôi |
| Ghép xong là vào trận ngay | Còn phải có sân trống đúng giờ |

Game ghép trong vài giây và trận bắt đầu ngay. Thể thao cần sân trống, giờ hẹn trước và thời gian đi lại. Vì vậy MONSPORT hợp với cách "gợi ý rồi người chơi tự chọn" hơn cách "bấm Tìm trận rồi chờ".

## 3. Đo trình độ: các hệ rating chính

### 3.1 Elo (cờ vua, FIDE)

```
E_A  = 1 / (1 + 10^((R_B − R_A) / 400))     điểm kỳ vọng của A
R_A' = R_A + K · (S_A − E_A)                S = 1 thắng, 0.5 hòa, 0 thua
```

- Khi chênh 400 điểm, bên mạnh có điểm kỳ vọng khoảng 0.91.
- FIDE dùng 3 mức K:
  - K = 40 cho người mới, đến khi đủ 30 ván.
  - K = 20 cho người dưới 2400.
  - K = 10 từ 2400 trở lên.
- Với người dưới 2650, chênh lệch hơn 400 điểm được tính như 400.
- Ví dụ: A (1500) gặp B (1700), K = 32. E_A = 0.24.
  - A thắng: A được cộng 24, lên 1524.
  - A thua: A bị trừ 8, còn 1492.

Elo đơn giản, và tổng điểm của hai bên không đổi. Nhưng Elo không biết rating của ai chắc chắn đến đâu. Người mới và người vừa quay lại đổi điểm cùng tốc độ. Elo chỉ dành cho trận 1 đấu 1.

### 3.2 Glicko và Glicko-2 (Mark Glickman)

Glicko thêm độ lệch rating (RD). Càng ít dữ liệu thì RD càng lớn, và rating càng thay đổi nhanh.

```
q     = ln(10) / 400
g(RD) = 1 / sqrt(1 + 3·q²·RD² / π²)
E     = 1 / (1 + 10^(−g(RD_j)·(r − r_j) / 400))
d²    = 1 / (q² · Σ g(RD_j)² · E · (1 − E))
r'    = r + q / (1/RD² + 1/d²) · Σ g(RD_j)·(s_j − E)
RD'   = sqrt(1 / (1/RD² + 1/d²))
Nghỉ t kỳ:  RD = min(sqrt(RD² + c²·t), 350)
```

- Người mới bắt đầu với r = 1500 và RD = 350.
- RD = 50 nghĩa là sức thật nằm trong khoảng r ± 100, với độ tin 95%.
- Glicko-2 thêm độ biến động σ. Người đánh thất thường thì rating dao động mạnh hơn. Hằng số τ (từ 0.3 đến 1.2) giới hạn tốc độ σ thay đổi.

### 3.3 TrueSkill (Microsoft) và OpenSkill

TrueSkill:

- Trình độ của mỗi người là một phân phối chuẩn N(μ, σ²). Mặc định μ = 25 và σ = 25/3.
- Phong độ trong một trận bằng trình độ cộng một nhiễu β. Phong độ của đội bằng tổng phong độ các thành viên.
- Sau mỗi trận, μ và σ được cập nhật bằng suy luận Bayes. Người có σ lớn thay đổi nhiều hơn.
- Số hiển thị là con số thận trọng μ − 3σ. Hệ thống chắc khoảng 99% rằng sức thật cao hơn số này. Người mới bắt đầu từ 0 rồi tăng dần.
- TrueSkill dùng được cho đánh đơn, đánh đôi, theo đội, và trận nhiều đội xếp hạng 1, 2, 3.

OpenSkill dựa trên bài báo của Weng và Lin (JMLR 2011):

- Cùng ý tưởng μ/σ, nhưng công thức cập nhật gọn hơn và không cần đồ thị nhân tử.
- Dự án tự giới thiệu là bản thay thế TrueSkill có giấy phép mở.
- Bài báo của dự án đo được tốc độ gấp khoảng 3 lần một thư viện TrueSkill Python phổ biến.
- Có gói npm `openskill` cho TypeScript.

### 3.4 Các môn vợt: tính cả cách biệt tỷ số

| Hệ | Môn | Ý chính |
|---|---|---|
| DUPR | Pickleball | Elo cải tiến. Dự đoán tỷ số trước trận. Thua nhưng ghi nhiều điểm hơn dự đoán thì rating vẫn tăng. Có thêm "độ tin cậy" từ 1 đến 100% |
| UTR | Tennis | Dựa trên phần trăm số game thắng, không chỉ thắng hay thua. Lấy trung bình có trọng số của tối đa 30 trận trong 12 tháng. Bỏ qua trận chênh hơn 2.00 mà bên mạnh thắng |

Có thể áp ý này vào Elo: thay S (1 hoặc 0) bằng tỷ lệ điểm thắng. Ví dụ thắng 11–7 thì S = 11/18 ≈ 0.61. Rủi ro là người chơi cố đánh dồn điểm, nên cần giới hạn mức ảnh hưởng của cách biệt.

## 4. FIFA và bóng đá thế giới tính thế nào

### 4.1 FIFA: phương pháp SUM, dùng từ tháng 8/2018

```
P  = P_trước + I · (W − We)
We = 1 / (10^(−dr/600) + 1)      dr = điểm đội mình − điểm đối thủ
```

| I | Loại trận |
|---|---|
| 5 | Giao hữu ngoài các đợt tập trung của FIFA |
| 10 | Giao hữu trong các đợt tập trung của FIFA |
| 15 | Nations League, vòng bảng |
| 25 | Nations League play-off và chung kết, vòng loại giải châu lục, vòng loại World Cup |
| 35 | Vòng chung kết châu lục, trước tứ kết |
| 40 | Vòng chung kết châu lục, từ tứ kết trở đi |
| 50 | World Cup, trước tứ kết |
| 60 | World Cup, từ tứ kết trở đi |

- W: thắng = 1, hòa = 0.5, thua = 0. Thắng luân lưu = 0.75, thua luân lưu = 0.5.
- Thua ở vòng loại trực tiếp của một vòng chung kết thì không bị trừ điểm.
- FIFA không tính hiệu số bàn thắng và không tính lợi thế sân nhà.
- Elo cờ vua chia cho 400, FIFA chia cho 600. Đường cong thoải hơn, nên cùng một mức chênh điểm cho kỳ vọng ít cực đoan hơn.

Ví dụ: đội A (1500 điểm) gặp đội B (1600 điểm) ở vòng bảng World Cup, I = 50. We của A = 0.405.

- A thắng: +50 × 0.595 = +29.7.
- Hòa: +50 × 0.095 = +4.7.
- A thua: −20.3. Đây là vòng bảng, nên luật không trừ điểm ở vòng loại trực tiếp không áp dụng.

### 4.2 World Football Elo (eloratings.net)

```
R'  = R + K·G · (W − We)
We  = 1 / (10^(−dr/400) + 1)      đội đá sân nhà được cộng 100 vào dr
```

- K theo loại trận:
  - 60: vòng chung kết World Cup.
  - 50: vòng chung kết châu lục và giải liên lục địa lớn.
  - 40: các vòng loại và giải lớn.
  - 30: các giải khác.
  - 20: giao hữu.
- G theo hiệu số bàn thắng N:
  - Thắng 1 bàn: G = 1.
  - Thắng 2 bàn: G = 1.5.
  - Thắng 3 bàn: G = 1.75.
  - Thắng từ 4 bàn: G = 1.75 + (N − 3)/8.

### 4.3 Điểm tích lũy của BWF

- BWF cộng điểm của 10 giải có điểm cao nhất trong 52 tuần gần nhất.
- Giải cấp cao hơn và vòng đấu sâu hơn cho nhiều điểm hơn.
- Khi bằng điểm, ai đánh nhiều giải hơn thì xếp trên.
- Hệ này không đo sức mạnh. Nó thưởng thành tích và sự chăm tham gia. ATP và WTA trong tennis cũng tích lũy điểm theo kiểu này.

Rating và ranking là hai thứ khác nhau, và giải đấu thường cần cả hai:

| | Rating | Ranking (điểm tích lũy) |
|---|---|---|
| Đo gì | Sức mạnh hiện tại | Thành tích trong một khoảng thời gian |
| Dùng để | Ghép trận, xếp hạt giống, dự đoán | Bảng xếp hạng mùa, suất dự giải, phần thưởng |
| Thua có bị trừ không | Có | Không. Điểm chỉ hết hạn sau 52 tuần |
| Ví dụ | Elo, Glicko, TrueSkill, DUPR, FIFA SUM | BWF, ATP |

## 5. Thể thức giải và thuật toán đi kèm

| Thể thức | Hợp với | Số trận hoặc số vòng | Thuật toán |
|---|---|---|---|
| Vòng tròn | Giải nhỏ, 4–8 đội | n(n−1)/2 trận | Lập lịch kiểu vòng tròn (bảng Berger): giữ cố định 1 đội, xoay các đội còn lại mỗi vòng |
| Loại trực tiếp | Nhiều đội, ít thời gian | n − 1 trận | Xếp hạt giống theo rating. Nhánh 8 đội: 1–8, 4–5, 3–6, 2–7. Số đội không phải lũy thừa của 2 thì hạt giống cao được miễn đấu vòng đầu |
| Loại kép | Muốn công bằng hơn | 2n − 2 hoặc 2n − 1 trận | Có nhánh thắng và nhánh thua |
| Chia bảng rồi loại trực tiếp | Kiểu World Cup | Tùy số bảng | Chia các đội vào nhóm hạt giống, bốc thăm trong từng nhóm |
| Hệ Thụy Sĩ | Nhiều người, ít vòng | Khoảng log₂(n) vòng | Mỗi vòng ghép những người bằng điểm nhau, không ai gặp lại nhau. Phần mềm dùng ghép trọng số lớn nhất (Edmonds blossom). FIDE công nhận bbpPairings cho hệ Dutch |
| Americano | Pickleball và padel giao lưu | Lịch cố định | Lập trước lịch xoay đồng đội, để ai cũng được đánh cặp với mọi người |
| Mexicano | Pickleball và padel giao lưu | Lập theo từng vòng | Vòng 1 bốc thăm. Từ vòng 2 xếp theo bảng điểm, mỗi sân 4 người. Cách phổ biến: hạng 1 cặp hạng 3, gặp hạng 2 cặp hạng 4, và tránh lặp lại đồng đội |

Khi bằng điểm, các tiêu chí phụ thường dùng là: thành tích đối đầu, hiệu số, số bàn hoặc số điểm thắng, rồi bốc thăm. Ghi rõ thứ tự này trong điều lệ trước khi giải bắt đầu.

## 6. Tìm sân trong bán kính 5–10 km

### 6.1 Lọc theo bán kính

Tính khoảng cách đường chim bay bằng công thức Haversine:

```
a = sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)
d = 2R · atan2(√a, √(1 − a))        R = 6371 km, φ = vĩ độ, λ = kinh độ (radian)
```

Chọn cách làm theo số sân:

| Số sân | Cách làm |
|---|---|
| Vài trăm đến vài nghìn | Tính Haversine cho mọi sân. Lọc trước bằng một khung chữ nhật quanh điểm: Δvĩ độ = r/111 km, Δkinh độ = r/(111·cos φ) |
| Nhiều hơn, chỉ dùng Postgres | Extension `earthdistance`: lọc bằng `earth_box(ll_to_earth(lat, lng), 10000) @> ll_to_earth(...)` với chỉ mục GiST. Kiểm lại bằng `earth_distance`, vì khung chữ nhật có cả điểm ngoài vòng tròn |
| Cần nhiều phép tính địa lý | PostGIS: `ST_DWithin(location, điểm, 10000)` trên kiểu `geography` (đơn vị mét), có chỉ mục GiST. Sắp sân gần nhất bằng `ORDER BY location <-> điểm` |
| Ghép và gom nhóm theo vùng | Lưới lục giác H3 của Uber: mỗi sân thuộc 1 ô. `gridDisk(ô, k)` trả về các ô cách ô gốc tối đa k bước. Lọc lại bằng khoảng cách thật, vì k là số bước lưới, không phải mét |

Nếu dùng PostGIS hoặc `earthdistance`, kiểm tra trước rằng Cloud SQL cho phép bật extension đó.

### 6.2 Xếp hạng, không chỉ theo độ gần

```
score = w1·exp(−d / 3 km) + w2·có_giờ_trống + w3·có_trận_mở_hợp_trình_độ + w4·đánh_giá_sân − w5·giá
```

### 6.3 Tự nới bán kính

Bắt đầu với 5 km. Có ít hơn N kết quả (ví dụ 5) thì nới lên 7.5 km, rồi 10 km. Mỗi thẻ sân ghi khoảng cách, ví dụ "cách bạn 3.2 km". Ý tưởng này giống việc game nới cửa sổ MMR khi người chơi chờ lâu.

### 6.4 Thời gian đi thay cho khoảng cách

Giờ cao điểm trong nội thành, đi 5 km có thể mất 30 phút. Lọc theo bán kính trước. Rồi chỉ gọi API chỉ đường (OSRM tự chạy, hoặc Google Routes) cho khoảng 20 sân đầu, để giữ chi phí thấp.

### 6.5 Ghép nhóm theo vùng: chọn sân ở giữa mọi người

Khi 6–10 người ở nhiều nơi muốn chơi chung, việc chọn sân là bài toán chọn địa điểm (facility location):

- Tổng quãng đường nhỏ nhất (1-median): chọn sân có tổng khoảng cách đến mọi người nhỏ nhất.
- Công bằng nhất (1-center): chọn sân mà người ở xa nhất đi ít nhất.
- Số sân ít nên thử hết được. Ví dụ 10 người và 200 sân là 2.000 phép tính.

### 6.6 Vị trí là dữ liệu cá nhân

- Chỉ xin quyền vị trí khi người dùng bấm "Sân gần tôi", không xin ngay lúc mở app.
- Chỉ dùng tọa độ cho lần tìm đó. Nếu cần lưu, lưu khu vực (quận hoặc ô H3), không lưu tọa độ chính xác.
- Cho người dùng chọn khu vực bằng tay khi họ không cho quyền vị trí.

## 7. Đề xuất cho MONSPORT

### Giai đoạn 1: ghi kết quả

- Chủ trận nhập tỷ số, và một người của đội kia xác nhận trong 24 giờ.
- Không có xác nhận, hoặc có tranh chấp, thì trận không được tính rating.
- Chỉ tính những trận gắn với lượt đặt sân đã được chủ sân xác nhận. Trận có thật nên khó làm giả.
- Mỗi môn có một rating riêng.

### Giai đoạn 2: rating

- Dùng OpenSkill. Một thuật toán đủ cho đánh đơn, đánh đôi và đội 5–7 người.
- Rating khởi đầu lấy từ 3 mức trình độ tự khai (F-039):
  - Mức thấp: μ = 20.
  - Mức giữa: μ = 25.
  - Mức Khá: μ = 30.
  - Cả ba mức dùng cùng σ ≈ 8.3, đủ lớn để rating tự sửa nhanh.
- Hiển thị: quy μ − 3σ về 3 hoặc 5 mức dễ hiểu. Gắn nhãn "tạm tính" khi người chơi chưa đủ khoảng 10 trận.
- Người nghỉ lâu thì tăng σ theo thời gian, như Glicko.
- Bản đầu chưa tính cách biệt tỷ số. Thêm sau cho các môn vợt, có giới hạn.
- Chống gian lận:
  - Giảm trọng số khi cùng một nhóm người gặp nhau nhiều lần.
  - Giảm trọng số trận của người có điểm uy tín thấp (F-032).
  - Người mới mà thắng đậm thì σ lớn nên rating tự tăng nhanh. Không cần luật riêng.

### Giai đoạn 3: giải đấu

- Dùng rating để xếp hạt giống và chia bảng.
- Có thêm điểm giải (ranking) riêng:
  - Điểm mỗi giải = điểm của cấp giải × vòng đạt được.
  - Chỉ cộng N giải tốt nhất trong 52 tuần, như BWF.
  - Thua không bị trừ điểm.
- Thể thức nên ưu tiên:
  - Bóng đá: chia bảng rồi loại trực tiếp.
  - Pickleball và cầu lông giao lưu: Mexicano hoặc Americano.

### Giai đoạn 4: ghép trận và gợi ý sân

- Sắp Phòng chờ theo hàm điểm phù hợp ở mục 1.
- Gợi ý sân theo mục 6: lọc bán kính, xếp hạng, tự nới bán kính.
- Chỉ làm "Ghép nhanh" theo lô (Hungary hoặc blossom) khi cùng một lúc có đủ người. Ngưỡng gợi ý: vài chục yêu cầu mỗi khung giờ ở mỗi khu vực.

### Cách biết rating có tốt không

- Trước mỗi trận, lưu xác suất thắng mà mô hình dự đoán.
- Sau trận, đo sai số bằng Brier score: trung bình của (p − kết quả)². Có thể dùng log loss thay thế.
- Chạy thử nhiều bộ tham số (σ ban đầu, β, τ, K) trên dữ liệu cũ. Chọn bộ có sai số nhỏ nhất.

## Nguồn

Ghép trận:

- Grab: [Using real-world patterns to improve matching](https://engineering.grab.com/using-real-world-patterns-to-improve-matching) và [Grab doesn't always assign the nearest driver](https://www.grab.com/inside-grab/stories/matching-driver-partners-and-riders-allocation/)
- [Abeywickrama, Liang, Tan, PVLDB 14 (2021)](https://www.vldb.org/pvldb/vol14/p1150-abeywickrama.pdf)
- Kuhn (1955), "The Hungarian method for the assignment problem". Gale và Shapley (1962), "College Admissions and the Stability of Marriage". Edmonds (1965), "Paths, trees, and flowers".
- [Riot: Ghép Trận và Tự Chọn Tất Cả](https://support.riotgames.com/vi-vn/league-of-legends/gameplay/matchmaking-and-autofill)
- [Wikipedia: Honor of Kings](https://en.wikipedia.org/wiki/Honor_of_Kings)
- [Cupid, re-matchmaking cho game MOBA (arXiv 2406.19720)](https://arxiv.org/abs/2406.19720)
- [EOMM: Engagement Optimized Matchmaking (arXiv 1702.06820)](https://arxiv.org/abs/1702.06820)

Rating và ranking:

- FIFA: [Men's World Ranking procedure](https://inside.fifa.com/fifa-world-ranking/procedure-men) và [Wikipedia: FIFA Men's World Ranking](https://en.wikipedia.org/wiki/FIFA_Men%27s_World_Ranking)
- [World Football Elo Ratings: About](https://www.eloratings.net/about)
- [FIDE Rating Regulations](https://handbook.fide.com/chapter/B022024)
- [Glickman, Example of the Glicko-2 system](http://www.glicko.net/glicko/glicko2.pdf) và [Wikipedia: Glicko rating system](https://en.wikipedia.org/wiki/Glicko_rating_system)
- [TrueSkill, NIPS 2006](https://papers.nips.cc/paper_files/paper/2006/file/f44ee263952e65b3610b8ba51229d1f9-Paper.pdf) và [Microsoft Research: TrueSkill](https://www.microsoft.com/en-us/research/publication/trueskilltm-a-bayesian-skill-rating-system/)
- OpenSkill: [arXiv 2401.05451](https://arxiv.org/abs/2401.05451) và [npm openskill](https://www.npmjs.com/package/openskill)
- [DUPR: How your rating is calculated](https://www.dupr.com/post/how-your-dupr-rating-is-calculated)
- [UTR: How the rating is calculated](https://support.universaltennis.com/en/support/solutions/articles/9000151894)
- [BWF: How ranking works](https://bwfbadminton.com/how-ranking-works/)

Giải đấu:

- [Sauer, Cseh, Lenzner, arXiv 2112.10522](https://arxiv.org/abs/2112.10522)
- Mexicano: [Skedge](https://skedge-web.web.app/resources/mexicano-format) và [Tournated](https://tournated.gitbook.io/tournated/tournated-portals/tournated-manager/tournament-formats/pairings-and-standings-swiss-americano-and-mexicano)

Tìm sân theo vị trí:

- [PostGIS ST_DWithin](https://postgis.net/docs/ST_DWithin.html), [toán tử <->](https://postgis.net/docs/geometry_distance_knn.html), [chỉ mục GiST cho geography](https://postgis.net/docs/using_postgis_dbmanagement.html)
- [PostgreSQL earthdistance](https://www.postgresql.org/docs/current/earthdistance.html)
- [H3 grid traversal (gridDisk)](https://h3geo.org/docs/api/traversal/)
