/* Ra Sân — dữ liệu giả lập (mock).
   Không có backend: mọi thay đổi chỉ sống trong phiên trình duyệt, tải lại trang là về ban đầu. */
(function () {
  'use strict';

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  const fmt = {
    date(off) { const d = new Date(today); d.setDate(d.getDate() + off); return d; },
    day(off) {
      if (off === 0) return 'Hôm nay';
      if (off === 1) return 'Ngày mai';
      if (off === -1) return 'Hôm qua';
      const d = fmt.date(off);
      return `${DOW[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}`;
    },
    dayParts(off) { const d = fmt.date(off); return { dow: DOW[d.getDay()], date: d.getDate(), month: d.getMonth() + 1 }; },
    hm(t) { const h = Math.floor(t), m = Math.round((t - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; },
    range(a, b) { return `${fmt.hm(a)}–${fmt.hm(b)}`; },
    vnd(n) { return n.toLocaleString('vi-VN') + 'đ'; },
    k(n) {
      if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0).replace('.', ',') + ' tr';
      return Math.round(n / 1000) + 'k';
    },
    nowHour() { const d = new Date(); return d.getHours() + d.getMinutes() / 60; },
  };

  const LEVELS = ['Mới chơi', 'Trung bình', 'Khá', 'Giỏi'];

  const SPORTS = [
    { id: 'football',    name: 'Bóng đá',     color: '#2F7D4F', deep: '#1E5936', court: 'pitch', on: true, unit: 'sân' },
    { id: 'badminton',   name: 'Cầu lông',    color: '#1C7C74', deep: '#125750', court: 'net',   on: true, unit: 'sân' },
    { id: 'pickleball',  name: 'Pickleball',  color: '#2E66C2', deep: '#1E4A92', court: 'net',   on: true, unit: 'sân' },
    { id: 'tennis',      name: 'Tennis',      color: '#C4613A', deep: '#964425', court: 'net',   on: true, unit: 'sân' },
    { id: 'basketball',  name: 'Bóng rổ',     color: '#B5722B', deep: '#86511A', court: 'hoop',  on: true, unit: 'sân' },
    { id: 'volleyball',  name: 'Bóng chuyền', color: '#B8913A', deep: '#8A6B27', court: 'net',   on: true, unit: 'sân' },
    { id: 'tabletennis', name: 'Bóng bàn',    color: '#35507F', deep: '#24395D', court: 'net',   on: true, unit: 'bàn' },
  ];

  const USERS = [
    { id: 'u1',  name: 'Trần Minh Khoa',   area: 'Quận 10',     role: 'player', joined: '03/2025', played: 86,  rep: 98, status: 'active', levels: { badminton: 'Khá', football: 'Trung bình', pickleball: 'Mới chơi' } },
    { id: 'u2',  name: 'Nguyễn Thu Hà',    area: 'Quận 3',      role: 'player', joined: '11/2024', played: 132, rep: 99, status: 'active', levels: { badminton: 'Khá', pickleball: 'Trung bình' } },
    { id: 'u3',  name: 'Lê Quốc Bảo',      area: 'Quận 4',      role: 'player', joined: '01/2025', played: 64,  rep: 95, status: 'active', levels: { football: 'Khá', basketball: 'Trung bình' } },
    { id: 'u4',  name: 'Phạm Gia Huy',     area: 'Quận 4',      role: 'player', joined: '05/2025', played: 41,  rep: 92, status: 'active', levels: { football: 'Trung bình' } },
    { id: 'u5',  name: 'Võ Ngọc Ánh',      area: 'Quận 10',     role: 'player', joined: '02/2025', played: 77,  rep: 97, status: 'active', levels: { badminton: 'Trung bình', volleyball: 'Khá' } },
    { id: 'u6',  name: 'Đặng Tuấn Kiệt',   area: 'Bình Thạnh',  role: 'player', joined: '09/2024', played: 158, rep: 96, status: 'active', levels: { football: 'Giỏi', tennis: 'Trung bình' } },
    { id: 'u7',  name: 'Bùi Thanh Tâm',    area: 'Quận 10',     role: 'player', joined: '08/2024', played: 203, rep: 99, status: 'active', levels: { badminton: 'Giỏi' } },
    { id: 'u8',  name: 'Hoàng Đức Long',   area: 'Tân Bình',    role: 'player', joined: '04/2025', played: 52,  rep: 90, status: 'active', levels: { football: 'Trung bình', tabletennis: 'Khá' } },
    { id: 'u9',  name: 'Ngô Mỹ Linh',      area: 'Phú Nhuận',   role: 'player', joined: '06/2025', played: 38,  rep: 94, status: 'active', levels: { badminton: 'Trung bình', pickleball: 'Khá' } },
    { id: 'u10', name: 'Dương Nhật Nam',   area: 'Quận 7',      role: 'player', joined: '12/2024', played: 91,  rep: 93, status: 'active', levels: { football: 'Khá', basketball: 'Khá' } },
    { id: 'u11', name: 'Lý Hải Yến',       area: 'TP Thủ Đức',  role: 'player', joined: '07/2025', played: 29,  rep: 96, status: 'active', levels: { pickleball: 'Khá', tennis: 'Trung bình' } },
    { id: 'u12', name: 'Trương Công Phúc', area: 'Quận 4',      role: 'player', joined: '09/2025', played: 12,  rep: 88, status: 'active', levels: { football: 'Mới chơi' } },
    { id: 'u13', name: 'Đỗ Khánh Vy',      area: 'Quận 1',      role: 'player', joined: '03/2025', played: 47,  rep: 97, status: 'active', levels: { volleyball: 'Trung bình', tabletennis: 'Trung bình' } },
    { id: 'u14', name: 'Phan Anh Tú',      area: 'Gò Vấp',      role: 'player', joined: '10/2024', played: 120, rep: 79, status: 'active', levels: { basketball: 'Giỏi' } },
    { id: 'u15', name: 'Huỳnh Bảo Trâm',   area: 'Quận 11',     role: 'player', joined: '08/2025', played: 23,  rep: 95, status: 'active', levels: { volleyball: 'Khá', badminton: 'Mới chơi' } },
    { id: 'u16', name: 'Mai Văn Sơn',      area: 'Tân Bình',    role: 'owner',  joined: '06/2024', played: 0,   rep: 97, status: 'active', levels: {} },
    { id: 'u17', name: 'Vũ Thị Hạnh',      area: 'Quận 10',     role: 'owner',  joined: '07/2024', played: 0,   rep: 98, status: 'active', levels: {} },
    { id: 'u18', name: 'Lâm Quang Vinh',   area: 'Quận 1',      role: 'admin',  joined: '01/2024', played: 0,   rep: 100, status: 'active', levels: {} },
    { id: 'u19', name: 'Tạ Hữu Đạt',       area: 'Bình Thạnh',  role: 'owner',  joined: '11/2026', played: 0,   rep: 0,  status: 'active', levels: {} },
    { id: 'u20', name: 'Châu Gia Bảo',     area: 'Quận 7',      role: 'player', joined: '05/2025', played: 34,  rep: 61, status: 'active', levels: { football: 'Trung bình' } },
    { id: 'u21', name: 'Kiều Đình Nghĩa',  area: 'Quận 12',     role: 'player', joined: '02/2025', played: 9,   rep: 44, status: 'locked', levels: { football: 'Mới chơi' } },
  ];

  const VENUES = [
    {
      id: 'v1', name: 'Sân bóng Gió Đông', district: 'Tân Bình', address: '48 hẻm 12 Cộng Hòa, P.4, Tân Bình',
      sports: ['football'], owner: 'u16', status: 'active', rating: 4.7, reviews: 214, km: 3.4, open: [5, 23],
      amenities: ['Giữ xe miễn phí', 'Căng tin', 'Cho thuê áo bib', 'Đèn LED'],
      courts: [
        { id: 'c1', name: 'Sân 5 · số 1', sport: 'football', price: 300000, peak: 450000, on: true },
        { id: 'c2', name: 'Sân 5 · số 2', sport: 'football', price: 300000, peak: 450000, on: true },
        { id: 'c3', name: 'Sân 7 · lớn',  sport: 'football', price: 500000, peak: 750000, on: true },
      ],
    },
    {
      id: 'v2', name: 'CLB Cầu lông Sao Mai', district: 'Quận 10', address: '215 Thành Thái, P.14, Quận 10',
      sports: ['badminton'], owner: 'u17', status: 'active', rating: 4.8, reviews: 389, km: 1.2, open: [5, 22],
      amenities: ['Thảm Yonex', 'Máy lạnh', 'Phòng thay đồ', 'Bán cầu, quấn cán'],
      courts: [
        { id: 'c1', name: 'Sân 1', sport: 'badminton', price: 80000, peak: 120000, on: true },
        { id: 'c2', name: 'Sân 2', sport: 'badminton', price: 80000, peak: 120000, on: true },
        { id: 'c3', name: 'Sân 3', sport: 'badminton', price: 80000, peak: 120000, on: true },
        { id: 'c4', name: 'Sân 4', sport: 'badminton', price: 80000, peak: 120000, on: true },
        { id: 'c5', name: 'Sân 5', sport: 'badminton', price: 90000, peak: 130000, on: true },
      ],
    },
    {
      id: 'v3', name: 'Pickle Yard Thảo Điền', district: 'TP Thủ Đức', address: '9 đường 61, Thảo Điền, TP Thủ Đức',
      sports: ['pickleball'], owner: 'u17', status: 'active', rating: 4.9, reviews: 156, km: 7.8, open: [6, 22],
      amenities: ['Mái che', 'Cho thuê vợt', 'Quầy nước', 'Tủ khóa'],
      courts: [
        { id: 'c1', name: 'Sân A', sport: 'pickleball', price: 150000, peak: 220000, on: true },
        { id: 'c2', name: 'Sân B', sport: 'pickleball', price: 150000, peak: 220000, on: true },
        { id: 'c3', name: 'Sân C', sport: 'pickleball', price: 150000, peak: 220000, on: true },
        { id: 'c4', name: 'Sân D', sport: 'pickleball', price: 150000, peak: 220000, on: true },
      ],
    },
    {
      id: 'v4', name: 'Tennis Hàng Me', district: 'Quận 3', address: '27 Tú Xương, P.7, Quận 3',
      sports: ['tennis'], owner: 'u17', status: 'active', rating: 4.5, reviews: 98, km: 2.6, open: [5, 22],
      amenities: ['Sân cứng', 'Nhặt bóng', 'Huấn luyện viên', 'Giữ xe'],
      courts: [
        { id: 'c1', name: 'Sân 1', sport: 'tennis', price: 220000, peak: 320000, on: true },
        { id: 'c2', name: 'Sân 2', sport: 'tennis', price: 220000, peak: 320000, on: true },
      ],
    },
    {
      id: 'v5', name: 'Nhà thi đấu Bến Nghé', district: 'Quận 1', address: '3 Nguyễn Bỉnh Khiêm, Bến Nghé, Quận 1',
      sports: ['basketball', 'volleyball', 'badminton'], owner: 'u17', status: 'active', rating: 4.6, reviews: 271, km: 4.1, open: [6, 22],
      amenities: ['Trong nhà', 'Sàn gỗ', 'Khán đài', 'Phòng thay đồ'],
      courts: [
        { id: 'c1', name: 'Sàn bóng rổ',     sport: 'basketball', price: 400000, peak: 550000, on: true },
        { id: 'c2', name: 'Sàn bóng chuyền', sport: 'volleyball', price: 350000, peak: 480000, on: true },
        { id: 'c3', name: 'Cầu lông 1',      sport: 'badminton',  price: 90000,  peak: 130000, on: true },
        { id: 'c4', name: 'Cầu lông 2',      sport: 'badminton',  price: 90000,  peak: 130000, on: true },
      ],
    },
    {
      id: 'v6', name: 'Sân bóng Cầu Kho', district: 'Quận 5', address: '102 Trần Bình Trọng, P.2, Quận 5',
      sports: ['football'], owner: 'u17', status: 'active', rating: 4.3, reviews: 143, km: 2.9, open: [5, 23],
      amenities: ['Cỏ nhân tạo mới', 'Giữ xe', 'Nước uống'],
      courts: [
        { id: 'c1', name: 'Sân 7 · A', sport: 'football', price: 480000, peak: 700000, on: true },
        { id: 'c2', name: 'Sân 7 · B', sport: 'football', price: 480000, peak: 700000, on: true },
        { id: 'c3', name: 'Sân 5',     sport: 'football', price: 280000, peak: 420000, on: true },
      ],
    },
    {
      id: 'v7', name: 'Bóng bàn Ngõ Nhỏ', district: 'Quận 1', address: '14/3 Đinh Tiên Hoàng, Đa Kao, Quận 1',
      sports: ['tabletennis'], owner: 'u17', status: 'active', rating: 4.4, reviews: 67, km: 3.7, open: [7, 22],
      amenities: ['Máy lạnh', 'Cho thuê vợt', 'Máy bắn bóng'],
      courts: [
        { id: 'c1', name: 'Bàn 1', sport: 'tabletennis', price: 50000, peak: 70000, on: true },
        { id: 'c2', name: 'Bàn 2', sport: 'tabletennis', price: 50000, peak: 70000, on: true },
        { id: 'c3', name: 'Bàn 3', sport: 'tabletennis', price: 50000, peak: 70000, on: true },
        { id: 'c4', name: 'Bàn 4', sport: 'tabletennis', price: 50000, peak: 70000, on: true },
      ],
    },
    {
      id: 'v8', name: 'Tổ hợp Bờ Kè Sports', district: 'Phú Nhuận', address: '660 Trường Sa, P.2, Phú Nhuận',
      sports: ['football', 'pickleball', 'basketball'], owner: 'u16', status: 'active', rating: 4.6, reviews: 302, km: 2.2, open: [5, 23],
      amenities: ['Ven kênh thoáng mát', 'Giữ xe', 'Cà phê', 'Tắm nước nóng'],
      courts: [
        { id: 'c1', name: 'Sân 7 cỏ nhân tạo', sport: 'football',   price: 520000, peak: 780000, on: true },
        { id: 'c2', name: 'Pickleball 1',      sport: 'pickleball', price: 140000, peak: 200000, on: true },
        { id: 'c3', name: 'Pickleball 2',      sport: 'pickleball', price: 140000, peak: 200000, on: true },
        { id: 'c4', name: 'Bóng rổ ngoài trời', sport: 'basketball', price: 250000, peak: 350000, on: false },
      ],
    },
    {
      id: 'v9', name: 'Sân cầu lông Bình Triệu', district: 'TP Thủ Đức', address: '71 đường 20, Hiệp Bình Chánh, TP Thủ Đức',
      sports: ['badminton'], owner: 'u19', status: 'pending', rating: 0, reviews: 0, km: 9.3, open: [5, 22], submitted: '2 giờ trước',
      amenities: ['Thảm PVC', 'Giữ xe'], docs: ['Giấy phép kinh doanh', 'Ảnh sân (8)', 'Bảng giá'],
      courts: [
        { id: 'c1', name: 'Sân 1', sport: 'badminton', price: 70000, peak: 100000, on: true },
        { id: 'c2', name: 'Sân 2', sport: 'badminton', price: 70000, peak: 100000, on: true },
        { id: 'c3', name: 'Sân 3', sport: 'badminton', price: 70000, peak: 100000, on: true },
      ],
    },
    {
      id: 'v10', name: 'Arena Pickleball Nam Sài Gòn', district: 'Quận 7', address: '18 Nguyễn Lương Bằng, Tân Phú, Quận 7',
      sports: ['pickleball', 'tennis'], owner: 'u19', status: 'pending', rating: 0, reviews: 0, km: 8.1, open: [6, 22], submitted: 'Hôm qua',
      amenities: ['Mái che', 'Bãi ô tô'], docs: ['Giấy phép kinh doanh', 'Ảnh sân (12)'],
      courts: [
        { id: 'c1', name: 'Pickleball 1', sport: 'pickleball', price: 160000, peak: 240000, on: true },
        { id: 'c2', name: 'Pickleball 2', sport: 'pickleball', price: 160000, peak: 240000, on: true },
        { id: 'c3', name: 'Tennis',       sport: 'tennis',     price: 250000, peak: 350000, on: true },
      ],
    },
    {
      id: 'v11', name: 'Sân bóng mini Hẻm 68', district: 'Gò Vấp', address: '68/5 Lê Đức Thọ, P.6, Gò Vấp',
      sports: ['football'], owner: 'u16', status: 'pending', rating: 0, reviews: 0, km: 6.5, open: [6, 22], submitted: '3 ngày trước',
      amenities: ['Giữ xe'], docs: ['Ảnh sân (3)'],
      courts: [{ id: 'c1', name: 'Sân 5', sport: 'football', price: 250000, peak: 380000, on: true }],
    },
  ];

  const TEAMS = [
    { id: 't1', name: 'FC Xóm Chiếu',        tag: 'XC', sport: 'football',   color: '#D9532A', captain: 'u1',  area: 'Quận 4',     level: 'Trung bình', w: 12, d: 3, l: 5, members: ['u1', 'u3', 'u4', 'u6', 'u8', 'u10', 'u12'] },
    { id: 't2', name: 'Sao Mai Smashers',    tag: 'SM', sport: 'badminton',  color: '#1C7C74', captain: 'u2',  area: 'Quận 10',    level: 'Khá',        w: 8,  d: 0, l: 4, members: ['u2', 'u1', 'u5', 'u9'] },
    { id: 't3', name: 'Lông Vũ Q10',         tag: 'LV', sport: 'badminton',  color: '#6B4FB3', captain: 'u7',  area: 'Quận 10',    level: 'Khá',        w: 15, d: 0, l: 6, members: ['u7', 'u15', 'u13', 'u11'] },
    { id: 't4', name: 'Bến Nghé Spikers',    tag: 'BN', sport: 'volleyball', color: '#B8913A', captain: 'u5',  area: 'Quận 1',     level: 'Khá',        w: 9,  d: 0, l: 3, members: ['u5', 'u13', 'u15', 'u2', 'u9', 'u11'] },
    { id: 't5', name: 'Volley Thủ Đức',      tag: 'VT', sport: 'volleyball', color: '#2E66C2', captain: 'u11', area: 'TP Thủ Đức', level: 'Trung bình', w: 6,  d: 0, l: 7, members: ['u11', 'u13', 'u15', 'u9', 'u7', 'u2'] },
    { id: 't6', name: 'Gió Đông United',     tag: 'GĐ', sport: 'football',   color: '#2F7D4F', captain: 'u6',  area: 'Tân Bình',   level: 'Khá',        w: 21, d: 4, l: 7, members: ['u6', 'u8', 'u10', 'u14', 'u20', 'u3', 'u4'] },
    { id: 't7', name: 'Hẻm 3x3',             tag: 'H3', sport: 'basketball', color: '#B5722B', captain: 'u14', area: 'Gò Vấp',     level: 'Giỏi',       w: 30, d: 0, l: 9, members: ['u14', 'u10', 'u3'] },
    { id: 't8', name: 'Thảo Điền Dinkers',   tag: 'TĐ', sport: 'pickleball', color: '#35507F', captain: 'u11', area: 'TP Thủ Đức', level: 'Trung bình', w: 5,  d: 0, l: 5, members: ['u11', 'u9', 'u2', 'u13'] },
    { id: 't9', name: 'Cộng Hòa Old Boys',   tag: 'CH', sport: 'football',   color: '#3A3F4A', captain: 'u8',  area: 'Tân Bình',   level: 'Trung bình', w: 7,  d: 5, l: 9, members: ['u8', 'u12', 'u20', 'u4', 'u21'] },
  ];

  /* type: 'solo' = kèo đơn (ghép từng người) · 'team' = kèo đội (đội gặp đội) */
  const MATCHES = [
    { id: 'm1',  type: 'solo', sport: 'badminton',  title: 'Đánh đôi giao lưu, xoay vòng 21 điểm', venue: 'v2', court: 'Sân 3', day: 0, start: 19, end: 21, level: 'Trung bình', fee: 45000, host: 'u2', slots: 4, players: ['u2', 'u5', 'u9'], note: 'Cầu Thành Công 77, chia đều tiền cầu. Đến sớm 10 phút khởi động nhé.', status: 'open' },
    { id: 'm2',  type: 'team', sport: 'football',   title: 'Tìm đối đá sân 5, có trọng tài', venue: 'v1', court: 'Sân 5 · số 2', day: 0, start: 20, end: 21, level: 'Trung bình', fee: 225000, host: 'u1', team: 't1', opponent: null, format: '5 vs 5', requests: ['t9'], note: 'Đá vui, không xoạc. Thua bao nước. Tiền sân chia đôi.', status: 'open' },
    { id: 'm3',  type: 'solo', sport: 'pickleball', title: 'Pickleball sáng cuối tuần, người mới OK', venue: 'v3', court: 'Sân A + B', day: 2, start: 6.5, end: 8.5, level: 'Mới chơi', fee: 60000, host: 'u11', slots: 8, players: ['u11', 'u9', 'u2', 'u13', 'u15'], note: 'Có sẵn vợt cho mượn. Mình hướng dẫn luật trong 10 phút đầu.', status: 'open' },
    { id: 'm4',  type: 'solo', sport: 'football',   title: 'Thiếu 3 chân sân 7, cần 1 thủ môn', venue: 'v6', court: 'Sân 7 · A', day: 1, start: 18.5, end: 20, level: 'Trung bình', fee: 50000, host: 'u3', slots: 14, players: ['u3', 'u4', 'u6', 'u8', 'u10', 'u12', 'u14', 'u20', 'u5', 'u13', 'u15'], note: 'Áo bib có sẵn. Thủ môn miễn phí tiền sân.', status: 'open' },
    { id: 'm5',  type: 'team', sport: 'badminton',  title: 'Giao hữu đồng đội 3 đôi', venue: 'v2', court: 'Sân 1 + 2', day: 3, start: 19, end: 21, level: 'Khá', fee: 240000, host: 'u7', team: 't3', opponent: null, format: '3 đôi', requests: [], note: 'Đánh 3 trận đôi, mỗi trận 3 set 21. Đội thua mời trà đá.', status: 'open' },
    { id: 'm6',  type: 'solo', sport: 'basketball', title: '3x3 nửa sân, đánh xoay đội', venue: 'v5', court: 'Sàn bóng rổ', day: 1, start: 17.5, end: 19, level: 'Khá', fee: 70000, host: 'u14', slots: 9, players: ['u14', 'u10', 'u3', 'u6', 'u20', 'u12'], note: 'Sàn gỗ trong nhà, mang giày đế sạch.', status: 'open' },
    { id: 'm7',  type: 'solo', sport: 'tennis',     title: 'Tìm partner rally sáng sớm', venue: 'v4', court: 'Sân 2', day: 1, start: 6, end: 7.5, level: 'Trung bình', fee: 165000, host: 'u6', slots: 2, players: ['u6'], note: 'Tập đều tay là chính, cuối buổi đánh 1 set.', status: 'open' },
    { id: 'm8',  type: 'team', sport: 'volleyball', title: 'Bóng chuyền 6 đấu 6, giao hữu tháng', venue: 'v5', court: 'Sàn bóng chuyền', day: 4, start: 19, end: 21, level: 'Khá', fee: 480000, host: 'u5', team: 't4', opponent: 't5', format: '6 vs 6', requests: [], note: 'Đánh 5 set. Có người bấm điểm.', status: 'matched' },
    { id: 'm9',  type: 'solo', sport: 'tabletennis', title: 'Bóng bàn tối, đánh vòng tròn', venue: 'v7', court: 'Bàn 1 + 2', day: 0, start: 20.5, end: 22, level: 'Trung bình', fee: 35000, host: 'u8', slots: 4, players: ['u8', 'u13'], note: 'Mặt mút gai hay phản xoáy đều chơi được.', status: 'open' },
    { id: 'm10', type: 'solo', sport: 'badminton',  title: 'Cầu lông thứ bảy, đánh đôi nam nữ', venue: 'v2', court: 'Sân 3', day: 2, start: 19, end: 21, level: 'Khá', fee: 50000, host: 'u1', slots: 6, players: ['u1', 'u7', 'u9', 'u2'], note: 'Mình đã gửi yêu cầu đặt sân, đang chờ chủ sân xác nhận.', status: 'open' },
    { id: 'm11', type: 'team', sport: 'football',   title: 'Gió Đông United tìm đối sân 7', venue: 'v8', court: 'Sân 7 cỏ nhân tạo', day: 2, start: 19, end: 20.5, level: 'Khá', fee: 390000, host: 'u6', team: 't6', opponent: null, format: '7 vs 7', requests: [], note: 'Đội đá đều tuần 2 buổi, muốn tìm đối ngang cơ. Có quay clip.', status: 'open' },
    { id: 'm12', type: 'team', sport: 'basketball', title: 'Hẻm 3x3 nhận thách đấu', venue: 'v5', court: 'Sàn bóng rổ', day: 5, start: 18, end: 19.5, level: 'Giỏi', fee: 275000, host: 'u14', team: 't7', opponent: null, format: '3 vs 3', requests: [], note: 'Luật FIBA 3x3, chạm 21 điểm thắng.', status: 'open' },
    { id: 'm13', type: 'solo', sport: 'pickleball', title: 'Pickleball sau giờ làm ở Bờ Kè', venue: 'v8', court: 'Pickleball 1', day: 1, start: 18, end: 20, level: 'Trung bình', fee: 55000, host: 'u9', slots: 4, players: ['u9', 'u11'], note: 'Đánh đôi, xoay cặp sau mỗi game.', status: 'open' },
    { id: 'm14', type: 'solo', sport: 'football',   title: 'Sân 5 tối thứ ba, đá kèo quen', venue: 'v1', court: 'Sân 5 · số 1', day: -2, start: 19, end: 20, level: 'Trung bình', fee: 45000, host: 'u3', slots: 10, players: ['u3', 'u1', 'u4', 'u6', 'u8', 'u10', 'u12', 'u14', 'u20', 'u5'], note: '', status: 'done', score: '6 – 4' },
    { id: 'm15', type: 'solo', sport: 'badminton',  title: 'Đánh đôi sáng chủ nhật', venue: 'v2', court: 'Sân 5', day: -5, start: 7, end: 9, level: 'Khá', fee: 45000, host: 'u7', slots: 4, players: ['u7', 'u1', 'u2', 'u9'], note: '', status: 'done', score: '2 – 1' },
    { id: 'm16', type: 'team', sport: 'football',   title: 'FC Xóm Chiếu vs Cộng Hòa Old Boys', venue: 'v1', court: 'Sân 5 · số 1', day: -7, start: 20, end: 21, level: 'Trung bình', fee: 225000, host: 'u1', team: 't1', opponent: 't9', format: '5 vs 5', requests: [], note: '', status: 'done', score: '4 – 2' },
  ];

  const BOOKINGS = [
    { id: 'b1',  venue: 'v1', court: 'c1', day: 0,  start: 18, end: 19, user: 'u3',  status: 'confirmed', price: 450000, ago: 'Hôm qua' },
    { id: 'b2',  venue: 'v1', court: 'c2', day: 0,  start: 20, end: 21, user: 'u1',  status: 'confirmed', price: 450000, ago: '2 ngày trước', match: 'm2' },
    { id: 'b3',  venue: 'v1', court: 'c1', day: 0,  start: 20, end: 22, user: 'u10', status: 'pending',   price: 900000, ago: '8 phút trước', note: 'Đội công ty, cần xuất hoá đơn.' },
    { id: 'b4',  venue: 'v1', court: 'c3', day: 1,  start: 18, end: 20, user: 'u6',  status: 'pending',   price: 1500000, ago: '25 phút trước' },
    { id: 'b5',  venue: 'v8', court: 'c2', day: 1,  start: 6,  end: 8,  user: 'u11', status: 'pending',   price: 280000, ago: '1 giờ trước', note: 'Cho mượn thêm 2 vợt được không ạ?' },
    { id: 'b6',  venue: 'v8', court: 'c1', day: 0,  start: 19, end: 21, user: 'u8',  status: 'confirmed', price: 1560000, ago: '3 ngày trước' },
    { id: 'b7',  venue: 'v8', court: 'c3', day: 1,  start: 18, end: 20, user: 'u9',  status: 'pending',   price: 400000, ago: '2 giờ trước', match: 'm13' },
    { id: 'b8',  venue: 'v1', court: 'c2', day: 2,  start: 19, end: 20, user: 'u4',  status: 'pending',   price: 450000, ago: '3 giờ trước' },
    { id: 'b9',  venue: 'v8', court: 'c3', day: 0,  start: 17, end: 18, user: 'u2',  status: 'confirmed', price: 200000, ago: 'Hôm qua' },
    { id: 'b10', venue: 'v1', court: 'c1', day: -1, start: 19, end: 20, user: 'u12', status: 'confirmed', price: 450000, ago: '4 ngày trước' },
    { id: 'b11', venue: 'v1', court: 'c3', day: 0,  start: 17, end: 18, user: 'u20', status: 'rejected',  price: 750000, ago: 'Hôm qua', reason: 'Khách từng bỏ sân 2 lần.' },
    { id: 'b12', venue: 'v2', court: 'c3', day: 2,  start: 19, end: 21, user: 'u1',  status: 'pending',   price: 240000, ago: '40 phút trước', match: 'm10' },
    { id: 'b13', venue: 'v3', court: 'c1', day: -3, start: 7,  end: 9,  user: 'u1',  status: 'confirmed', price: 300000, ago: '1 tuần trước' },
    { id: 'b14', venue: 'v8', court: 'c1', day: 2,  start: 19, end: 21, user: 'u6',  status: 'confirmed', price: 1560000, ago: 'Hôm qua', match: 'm11' },
    { id: 'b15', venue: 'v1', court: 'c2', day: 1,  start: 6,  end: 7,  user: 'u12', status: 'confirmed', price: 300000, ago: 'Hôm qua' },
    { id: 'b16', venue: 'v1', court: 'c3', day: 0,  start: 19, end: 21, user: 'u6',  status: 'confirmed', price: 1500000, ago: '2 ngày trước' },
    { id: 'b17', venue: 'v1', court: 'c2', day: 0,  start: 18, end: 19, user: 'u8',  status: 'confirmed', price: 450000, ago: 'Hôm qua' },
    { id: 'b18', venue: 'v1', court: 'c1', day: 0,  start: 6,  end: 7,  user: 'u4',  status: 'confirmed', price: 300000, ago: '3 ngày trước' },
    { id: 'b19', venue: 'v8', court: 'c2', day: 0,  start: 18, end: 20, user: 'u11', status: 'confirmed', price: 400000, ago: 'Hôm qua' },
    { id: 'b20', venue: 'v1', court: 'c1', day: 1,  start: 19, end: 21, user: 'u3',  status: 'confirmed', price: 900000, ago: 'Hôm qua' },
    { id: 'b21', venue: 'v8', court: 'c1', day: 1,  start: 20, end: 22, user: 'u10', status: 'confirmed', price: 1560000, ago: '2 ngày trước' },
  ];

  /* Khung giờ chủ sân tự khoá (bảo trì, giữ cho khách quen). Khoá: 'sân|sân con|ngày|giờ' */
  const LOCKS = { 'v1|c3|1|12': true, 'v1|c3|1|13': true, 'v8|c2|0|12': true };

  const NOTIFS = {
    player: [
      { id: 'n1', icon: 'check',  tone: 'ok',   text: '<b>Sân bóng Gió Đông</b> đã xác nhận đặt sân 20:00 hôm nay.', ago: '12 phút', to: '#/schedule', unread: true },
      { id: 'n2', icon: 'shield', tone: 'warn', text: '<b>Cộng Hòa Old Boys</b> muốn nhận kèo của FC Xóm Chiếu.', ago: '35 phút', to: '#/matches/m2', unread: true },
      { id: 'n3', icon: 'users',  tone: '',     text: '<b>Ngô Mỹ Linh</b> vừa tham gia kèo “Cầu lông thứ bảy”.', ago: '1 giờ', to: '#/matches/m10', unread: true },
      { id: 'n4', icon: 'clock',  tone: '',     text: 'Còn 3 giờ nữa tới trận <b>FC Xóm Chiếu</b> ở Gió Đông.', ago: '2 giờ', to: '#/matches/m2', unread: false },
      { id: 'n5', icon: 'star',   tone: '',     text: 'Đánh giá trận <b>Sân 5 tối thứ ba</b> để tăng điểm uy tín.', ago: 'Hôm qua', to: '#/matches/m14', unread: false },
      { id: 'n6', icon: 'pin',    tone: '',     text: '<b>CLB Cầu lông Sao Mai</b> mở thêm khung 21:00–22:00.', ago: '2 ngày', to: '#/venues/v2', unread: false },
    ],
    owner: [
      { id: 'o1', icon: 'inbox', tone: 'warn', text: '<b>Dương Nhật Nam</b> gửi yêu cầu đặt Sân 5 · số 1, 20:00 hôm nay.', ago: '8 phút', to: '#/owner/requests', unread: true },
      { id: 'o2', icon: 'inbox', tone: 'warn', text: '<b>Đặng Tuấn Kiệt</b> gửi yêu cầu đặt Sân 7 · lớn, ngày mai.', ago: '25 phút', to: '#/owner/requests', unread: true },
      { id: 'o3', icon: 'star',  tone: '',     text: 'Bờ Kè Sports nhận đánh giá 5 sao mới.', ago: '3 giờ', to: '#/owner/courts', unread: false },
    ],
    admin: [
      { id: 'a1', icon: 'store', tone: 'warn', text: '<b>Sân cầu lông Bình Triệu</b> gửi hồ sơ đăng ký.', ago: '2 giờ', to: '#/admin/venues', unread: true },
      { id: 'a2', icon: 'flag',  tone: 'bad',  text: 'Báo cáo mới: <b>Châu Gia Bảo</b> bùng kèo 2 lần.', ago: '4 giờ', to: '#/admin/reports', unread: true },
      { id: 'a3', icon: 'chart', tone: '',     text: 'Số trận ghép tuần này tăng 18%.', ago: 'Hôm qua', to: '#/admin/overview', unread: false },
    ],
  };

  const REPORTS = [
    { id: 'r1', kind: 'user',  target: 'u20', by: 'u3',  type: 'Không đến sân', text: 'Nhận kèo sân 7 hai lần liên tiếp rồi không tới, không báo trước. Đội phải đá thiếu người.', ago: '4 giờ trước', status: 'open' },
    { id: 'r2', kind: 'venue', target: 'v6',  by: 'u8',  type: 'Sai thông tin sân', text: 'Giá thu tại sân cao hơn giá niêm yết trên ứng dụng 50.000đ/giờ vào khung tối.', ago: '9 giờ trước', status: 'open' },
    { id: 'r3', kind: 'user',  target: 'u14', by: 'u13', type: 'Ngôn từ', text: 'Lời lẽ xúc phạm trong phần trò chuyện của trận 3x3 tối thứ năm.', ago: 'Hôm qua', status: 'open' },
    { id: 'r4', kind: 'match', target: 'm4',  by: 'u12', type: 'Thu phí sai', text: 'Chủ kèo thu 70k/người trong khi kèo ghi 50k.', ago: '2 ngày trước', status: 'open' },
    { id: 'r5', kind: 'user',  target: 'u21', by: 'u6',  type: 'Không đến sân', text: 'Bùng kèo nhiều lần, đã nhắc nhở nhưng không cải thiện.', ago: '1 tuần trước', status: 'resolved', result: 'Đã khoá tài khoản' },
  ];

  const CHATS = {
    m1: [
      { by: 'u2', text: 'Mọi người đến 18:50 nha, mình giữ sân 3.', at: '14:02' },
      { by: 'u5', text: 'Ok chị. Em mang 1 ống cầu.', at: '14:10' },
      { by: 'u9', text: 'Em tới trễ 5 phút được không ạ?', at: '15:31' },
    ],
    m2: [
      { by: 'u3', text: 'Tối nay đủ 7 người rồi nhé đội trưởng.', at: '11:20' },
      { by: 'u1', text: 'Ngon. Đang chờ chốt đối, có Cộng Hòa Old Boys xin nhận.', at: '11:24' },
    ],
    m10: [
      { by: 'u7', text: 'Thứ bảy mình mang cầu, mọi người khỏi mua.', at: '09:15' },
      { by: 'u1', text: 'Cảm ơn anh Tâm. Sân đang chờ xác nhận, có tin mình báo.', at: '09:18' },
    ],
  };

  const ACTIVITY = [
    { text: '<b>Nguyễn Thu Hà</b> tạo kèo đơn Cầu lông tại Sao Mai', ago: '5 phút' },
    { text: '<b>Sân bóng Gió Đông</b> xác nhận 3 lượt đặt sân', ago: '18 phút' },
    { text: '<b>Gió Đông United</b> đăng kèo đội tìm đối sân 7', ago: '42 phút' },
    { text: '<b>Tạ Hữu Đạt</b> đăng ký làm chủ sân', ago: '2 giờ' },
    { text: '<b>Lê Quốc Bảo</b> báo cáo một người chơi', ago: '4 giờ' },
    { text: '<b>Pickle Yard Thảo Điền</b> cập nhật bảng giá', ago: '6 giờ' },
  ];

  const STATS = {
    ownerRevenue: [3.2, 2.8, 4.1, 3.6, 5.4, 7.9, 6.3], // triệu đồng, 7 ngày gần nhất (kết thúc hôm nay)
    ownerFill: [48, 44, 57, 52, 66, 83, 74],            // % lấp đầy
    adminMatches: [212, 240, 231, 268, 290, 284, 325, 341, 372, 368, 410, 484], // trận ghép / tuần
    adminKpi: { users: 18420, usersDelta: 6.2, venues: 312, venuesDelta: 3.1, matches: 484, matchesDelta: 18, fill: 71, fillDelta: 4 },
    sportShare: { football: 34, badminton: 27, pickleball: 16, tennis: 7, basketball: 7, volleyball: 5, tabletennis: 4 },
  };

  const by = (arr) => (id) => arr.find((x) => x.id === id);

  window.DB = {
    fmt, LEVELS, SPORTS, USERS, VENUES, TEAMS, MATCHES, BOOKINGS, LOCKS, NOTIFS, REPORTS, CHATS, ACTIVITY, STATS,
    sport: by(SPORTS), user: by(USERS), venue: by(VENUES), team: by(TEAMS), match: by(MATCHES), booking: by(BOOKINGS),
    court(vId, cId) { const v = by(VENUES)(vId); return v && v.courts.find((c) => c.id === cId); },
    /* Giá theo khung giờ: từ 17:00 là giờ cao điểm */
    price(court, hour) { return hour >= 17 ? court.peak : court.price; },
    /* Trạng thái một ô giờ: past | booked | pending | free */
    slot(vId, cId, day, hour) {
      if (day < 0 || (day === 0 && hour <= fmt.nowHour())) return 'past';
      const b = BOOKINGS.find((x) => x.venue === vId && x.court === cId && x.day === day && hour >= x.start && hour < x.end && (x.status === 'confirmed' || x.status === 'pending'));
      if (b) return b.status === 'confirmed' ? 'booked' : 'pending';
      if (LOCKS[`${vId}|${cId}|${day}|${hour}`]) return 'booked';
      /* Sân của chủ sân mẫu (u16) chỉ dùng lượt đặt thật, để khớp với lịch bên kênh chủ sân */
      if (by(VENUES)(vId).owner === 'u16') return 'free';
      let h = 7;
      for (const ch of `${vId}${cId}${day}${hour}`) h = (h * 31 + ch.charCodeAt(0)) % 997;
      const busy = hour >= 17 && hour <= 20 ? 0.5 : 0.2;
      return h / 997 < busy ? 'booked' : 'free';
    },
  };
})();
