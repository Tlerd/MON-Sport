/* Ra Sân · bản WEB (desktop). Giao diện mẫu, dựng bằng JS thuần, không cần build.
   Bố cục kiểu trang web: thanh trên cùng có tab, cột trái, cột phải, bảng và lưới rộng.
   Khi thu hẹp cửa sổ, trang vẫn là trang web (ẩn cột, mở ngăn kéo), không biến thành giao diện điện thoại. */
(() => {
  'use strict';
  const D = window.DB, F = D.fmt;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ME = 'u1', OWNER = 'u16', ADMIN = 'u18';
  const MODEL = 'Claude Fable 5.2';

  const S = {
    role: 'player', q: '',
    f: { sport: 'all', type: 'all', level: 'all', day: 'all' },
    vf: { sport: 'all' },
    day: 0, picks: [], note: '',
    pop: null, modal: null, drawer: false,
    sched: 'upcoming', form: null, draft: '', teamReq: {},
    o: { venue: 'v1', day: 0, tab: 'pending' },
    a: { q: '', role: 'all' },
  };
  const who = () => ({ player: ME, owner: OWNER, admin: ADMIN }[S.role]);
  const homeOf = (role = S.role) => ({ player: '#/home', owner: '#/owner/overview', admin: '#/admin/overview' }[role]);

  /* ---------- Biểu tượng ---------- */
  const I = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    zap: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    pin: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9 6.6 19.8l1.1-6.1L3.2 9.4l6.1-.8z"/>',
    chevR: '<path d="m9 6 6 6-6 6"/>', chevL: '<path d="m15 6-6 6 6 6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/>',
    inbox: '<path d="M3 13 6 5h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M2 20h20"/>',
    flag: '<path d="M5 21V4h12l-2 4 2 4H5"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    send: '<path d="M21 3 3 10.5l7 2.5 2.5 7z"/>',
    store: '<path d="M4 9 5.5 4h13L20 9M4 9v11h16V9M4 9h16M9 20v-6h6v6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H4v1a3 3 0 0 0 4 3M16 6h4v1a3 3 0 0 1-4 3M12 13v4M8 20h8"/>',
    wallet: '<rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M16 14.5h2"/>',
    ball: '<circle cx="12" cy="12" r="9"/><path d="M5.2 6.2c3.6 2.6 3.6 9 0 11.6M18.8 6.2c-3.6 2.6-3.6 9 0 11.6"/>',
  };
  const icon = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n] || ''}</svg>`;

  const SP = {
    football: '<circle cx="12" cy="12" r="9"/><path d="m12 8 3.6 2.6-1.4 4.2H9.8l-1.4-4.2zM12 3.2V8M20.4 9.8l-4.8.8M17.3 19.2l-3.1-4.4M6.7 19.2l3.1-4.4M3.6 9.8l4.8.8"/>',
    badminton: '<path d="M9.5 16 6 5l3 1.2L12 4l3 2.2L18 5l-3.5 11zM12 4v12M9 6.2 10.7 16M15 6.2 13.3 16"/><path d="M9.5 16v1.5a2.5 2.5 0 0 0 5 0V16"/>',
    pickleball: '<circle cx="12" cy="12" r="9"/><g fill="currentColor" stroke="none"><circle cx="8.5" cy="9" r="1.1"/><circle cx="12.5" cy="7.5" r="1.1"/><circle cx="16" cy="10.5" r="1.1"/><circle cx="8" cy="13.5" r="1.1"/><circle cx="12" cy="12" r="1.1"/><circle cx="15.5" cy="15" r="1.1"/><circle cx="11" cy="16.5" r="1.1"/></g>',
    tennis: I.ball,
    basketball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3 2.8 3 10 0 12.8M18.4 5.6c-3 2.8-3 10 0 12.8"/>',
    volleyball: '<circle cx="12" cy="12" r="9"/><path d="M12 12c0-4 2-7 5-8M12 12c3.5 2 7 1.6 8.8-.6M12 12c-3.5 2-5 5.5-4.2 8.2M12 3c-2 2.5-2.6 5-2 7.6M20.5 15c-3 1-5.6.4-7.6-1.4M4 16.5c1-3 3-4.6 5.6-5.2"/>',
    tabletennis: '<circle cx="10" cy="9.5" r="6"/><path d="m14 14 5.5 5.5"/><circle cx="18.5" cy="6" r="1.5"/>',
  };
  const sportIcon = (id, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SP[id] || ''}</svg>`;

  /* Hình sân nhìn từ trên xuống: dùng thay ảnh chụp */
  function courtArt(sportId) {
    const sp = D.sport(sportId);
    const lines = {
      pitch: '<rect x="10" y="10" width="140" height="80" rx="2"/><path d="M80 10v80"/><circle cx="80" cy="50" r="13"/><rect x="10" y="30" width="20" height="40"/><rect x="130" y="30" width="20" height="40"/><rect x="10" y="41" width="8" height="18"/><rect x="142" y="41" width="8" height="18"/>',
      net: '<rect x="10" y="10" width="140" height="80" rx="1"/><path d="M10 22h140M10 78h140M46 22v56M114 22v56M46 50h68"/><path class="net" d="M80 5v90"/>',
      hoop: '<rect x="10" y="10" width="140" height="80" rx="2"/><path d="M80 10v80"/><circle cx="80" cy="50" r="11"/><path d="M10 36h24v28H10M150 36h-24v28h24M34 40a10 10 0 0 1 0 20M126 40a10 10 0 0 0 0 20M10 18h10a32 32 0 0 1 0 64H10M150 18h-10a32 32 0 0 0 0 64h10"/>',
    }[sp.court];
    return `<svg class="court" viewBox="0 0 160 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="160" height="100" fill="${sp.color}"/><path d="M0 0h32v100H0zM64 0h32v100H64zM128 0h32v100h-32z" fill="${sp.deep}" opacity=".28"/><g>${lines}</g></svg>`;
  }

  const AV = ['#2F7D4F', '#C4613A', '#2E66C2', '#6B4FB3', '#B5722B', '#1C7C74', '#A63D5E', '#35507F'];
  const first = (u) => u.name.split(' ').pop();
  function avatar(id, size = 36, cls = '') {
    const u = D.user(id), w = u.name.split(' ');
    return `<span class="av ${cls}" style="--s:${size}px;--c:${AV[+id.slice(1) % AV.length]}" title="${esc(u.name)}">${(w[w.length - 2] || '')[0] || ''}${w[w.length - 1][0]}</span>`;
  }
  function crest(tid, size = 40) {
    const t = tid && D.team(tid);
    return `<span class="crest ${t ? '' : 'none'}" style="--s:${size}px;--c:${t ? t.color : 'transparent'}"><svg viewBox="0 0 40 46"><path d="M20 2 37 8v14c0 11-7.5 18.5-17 22C10.5 40.5 3 33 3 22V8z"/></svg><b>${t ? t.tag : '?'}</b></span>`;
  }

  /* ---------- Tiện ích ---------- */
  const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
  const km = (v) => String(v.km).replace('.', ',');
  const left = (m) => m.slots - m.players.length;
  const myTeamIds = () => D.TEAMS.filter((t) => t.members.includes(ME)).map((t) => t.id);
  const capTeams = (sport) => D.TEAMS.filter((t) => t.captain === ME && (!sport || t.sport === sport));
  const inMatch = (m) => (m.type === 'solo' ? m.players.includes(ME) : myTeamIds().includes(m.team) || myTeamIds().includes(m.opponent));
  const sportsOn = () => D.SPORTS.filter((s) => s.on);
  const setPath = (path, v) => { const p = path.split('.'); let o = S; while (p.length > 1) o = o[p.shift()]; o[p[0]] = v; };
  const getPath = (path) => path.split('.').reduce((o, k) => o[k], S);
  const empty = (title, text, action = '') => `<div class="empty"><span class="empty-ball">${icon('ball', 30)}</span><h3>${title}</h3><p>${text}</p>${action}</div>`;

  function toast(msg, tone = '') {
    const el = document.createElement('div');
    el.className = `toast ${tone}`;
    el.innerHTML = `${icon(tone === 'bad' ? 'x' : 'check', 16)}<span>${msg}</span>`;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 250); }, 3400);
  }

  function seg(path, opts) {
    const cur = String(getPath(path));
    return `<div class="seg" role="tablist">${opts.map(([v, l, n]) => `<button role="tab" aria-selected="${cur === String(v)}" class="${cur === String(v) ? 'on' : ''}" data-act="set" data-k="${path}" data-v="${v}">${l}${n ? `<i>${n}</i>` : ''}</button>`).join('')}</div>`;
  }
  function select(path, opts, label) {
    const cur = String(getPath(path));
    return `<label class="sel"><span class="sr">${label}</span><select data-model="${path}" data-live>${opts.map(([v, l]) => `<option value="${v}" ${cur === String(v) ? 'selected' : ''}>${l}</option>`).join('')}</select>${icon('chevD', 16)}</label>`;
  }
  function sportChips(path) {
    const cur = getPath(path);
    return `<div class="chips"><button class="chip ${cur === 'all' ? 'on' : ''}" data-act="set" data-k="${path}" data-v="all">Tất cả môn</button>${sportsOn().map((s) => `<button class="chip ${cur === s.id ? 'on' : ''}" data-act="set" data-k="${path}" data-v="${s.id}">${sportIcon(s.id, 17)}${s.name}</button>`).join('')}</div>`;
  }
  const dayStrip = (path, n = 7) => `<div class="days">${range(0, n).map((d) => { const p = F.dayParts(d); return `<button class="${+getPath(path) === d ? 'on' : ''}" data-act="set" data-k="${path}" data-v="${d}" data-num="1" data-reset="picks"><small>${d === 0 ? 'Hôm nay' : p.dow}</small><b>${p.date}</b><small>Th${p.month}</small></button>`; }).join('')}</div>`;

  /* ---------- Trận ---------- */
  function listMatches() {
    const q = S.q.trim().toLowerCase();
    return D.MATCHES.filter((m) => m.day >= 0 && m.status !== 'done' && D.sport(m.sport).on)
      .filter((m) => S.f.sport === 'all' || m.sport === S.f.sport)
      .filter((m) => S.f.type === 'all' || m.type === S.f.type)
      .filter((m) => S.f.level === 'all' || m.level === S.f.level)
      .filter((m) => S.f.day === 'all' || m.day === +S.f.day)
      .filter((m) => { const v = D.venue(m.venue); return !q || `${m.title} ${v.name} ${v.district} ${D.sport(m.sport).name}`.toLowerCase().includes(q); })
      .sort((a, b) => a.day - b.day || a.start - b.start);
  }
  function statusTag(m) {
    if (m.status === 'done') return `<span class="tag ghost">Đã xong</span>`;
    if (m.type === 'team') return m.opponent ? `<span class="tag ghost">Đã có đối</span>` : `<span class="tag warn">Đang tìm đối</span>`;
    const l = left(m);
    return l <= 0 ? `<span class="tag ghost">Đủ người</span>` : `<span class="tag ${l <= 2 ? 'warn' : 'open'}">${l <= 2 ? 'Thiếu ' + l : 'Còn ' + l + ' chỗ'}</span>`;
  }
  function stack(m, max = 6) {
    const shown = m.players.slice(0, max).map((p) => avatar(p, 28)).join('');
    const more = m.players.length > max ? `<span class="av more" style="--s:28px">+${m.players.length - max}</span>` : '';
    const holes = Array(Math.max(0, Math.min(left(m), 4))).fill('<span class="av hole" style="--s:28px"></span>').join('');
    return `<div class="stack" aria-label="${m.players.length} trên ${m.slots} người">${shown}${more}${holes}</div>`;
  }
  function cta(m, big) {
    const c = big ? 'btn' : 'btn sm';
    if (m.status === 'done') return `<span class="pill">Đã xong${m.score ? ' · ' + m.score : ''}</span>`;
    if (m.type === 'solo') {
      if (m.host === ME) return `<span class="pill mine">Kèo của bạn</span>${big ? `<button class="${c} ghost" data-act="share">Chia sẻ kèo</button>` : ''}`;
      if (m.players.includes(ME)) return big ? `<span class="pill ok">${icon('check', 14)}Bạn đã tham gia</span><button class="${c} ghost" data-act="leave" data-id="${m.id}">Rời kèo</button>` : `<span class="pill ok">${icon('check', 14)}Đã tham gia</span>`;
      if (left(m) <= 0) return `<button class="${c}" disabled>Đủ người</button>`;
      return `<button class="${c} lime" data-act="join" data-id="${m.id}">Tham gia${big ? ' · ' + F.k(m.fee) : ''}</button>`;
    }
    const mine = myTeamIds();
    if (mine.includes(m.team) || mine.includes(m.opponent)) return `<span class="pill mine">Đội của bạn</span>${big ? `<button class="${c} ghost" data-act="share">Chia sẻ kèo</button>` : ''}`;
    if (m.opponent) return `<span class="pill">Đã có đối</span>`;
    if (m.requests.some((t) => D.team(t).captain === ME)) return `<span class="pill ok">${icon('check', 14)}Đã gửi lời nhận kèo</span>${big ? `<button class="${c} ghost" data-act="withdraw" data-id="${m.id}">Rút lại</button>` : ''}`;
    return `<button class="${c} lime" data-act="accept" data-id="${m.id}">Nhận kèo${big ? ' · ' + F.k(m.fee) + '/đội' : ''}</button>`;
  }
  function matchCard(m, o = {}) {
    const sp = D.sport(m.sport), v = D.venue(m.venue), a = D.team(m.team), b = m.opponent && D.team(m.opponent);
    const row = m.type === 'solo'
      ? `<div class="mc-f">${stack(m)}<span class="fee"><b>${F.k(m.fee)}</b>/người</span>${cta(m)}</div>`
      : `<div class="mc-f"><div class="vs">${crest(m.team, 30)}<span>${esc(a.name)}</span><em>vs</em>${crest(m.opponent, 30)}<span class="${b ? '' : 'dim'}">${b ? esc(b.name) : 'chờ đối'}</span></div>${cta(m)}</div>`;
    return `<article class="mc ${o.on ? 'on' : ''} ${o.compact ? 'compact' : ''}" data-act="go" data-to="#/matches/${m.id}" tabindex="0">
      <div class="stub">${courtArt(m.sport)}<span class="stub-sport">${sportIcon(m.sport, 14)}${sp.name}</span><div class="stub-when"><b>${F.hm(m.start)}</b><span>${F.day(m.day)}</span></div></div>
      <div class="mc-b">
        <div class="tags"><span class="tag ${m.type}">${m.type === 'solo' ? 'Kèo đơn' : 'Kèo đội · ' + m.format}</span>${statusTag(m)}<span class="tag ghost">${m.level}</span></div>
        <h3>${esc(m.title)}</h3>
        <p class="meta">${icon('pin', 15)}${esc(v.name)} · ${v.district} · ${km(v)} km</p>
        ${row}
      </div>
    </article>`;
  }
  function matchDetail(m) {
    const sp = D.sport(m.sport), v = D.venue(m.venue), host = D.user(m.host), chat = D.CHATS[m.id] || [];
    const canChat = inMatch(m) || m.host === ME;
    let panel;
    if (m.type === 'solo') {
      const pct = Math.round((m.players.length / m.slots) * 100);
      panel = `<section><h4>Người chơi <span>${m.players.length}/${m.slots}</span></h4><div class="meter"><i style="width:${pct}%"></i></div>
        <div class="roster">${m.players.map((p) => { const u = D.user(p); return `<div class="rp">${avatar(p, 38)}<div><b>${esc(u.name)}${p === ME ? ' (bạn)' : ''}</b><small>${u.levels[m.sport] || 'Chưa xếp hạng'} · uy tín ${u.rep}%</small></div>${p === m.host ? '<span class="tag ghost">Chủ kèo</span>' : ''}</div>`; }).join('')}
        ${Array(Math.max(0, left(m))).fill(`<div class="rp hole"><span class="av hole" style="--s:38px"></span><div><b>Chỗ trống</b><small>Đang chờ người ghép</small></div></div>`).join('')}</div></section>`;
    } else {
      const side = (tid) => { const t = tid && D.team(tid); return t ? `<a class="side-team" href="#/teams/${t.id}">${crest(t.id, 68)}<b>${esc(t.name)}</b><small>${t.w} thắng · ${t.d} hòa · ${t.l} thua</small><small>${t.members.length} thành viên · ${t.level}</small></a>` : `<div class="side-team none">${crest(null, 68)}<b>Đang tìm đối</b><small>Đội trưởng đội ${sp.name} có thể nhận kèo</small></div>`; };
      const reqs = D.team(m.team).captain === ME && !m.opponent && m.requests.length
        ? `<div class="reqs"><h4>Đội xin nhận kèo <span>${m.requests.length}</span></h4>${m.requests.map((tid) => { const t = D.team(tid); return `<div class="rp">${crest(tid, 38)}<div><b>${esc(t.name)}</b><small>${t.level} · ${t.w}-${t.d}-${t.l} · ${t.area}</small></div><button class="btn sm ghost" data-act="declineReq" data-id="${m.id}" data-team="${tid}">Từ chối</button><button class="btn sm lime" data-act="approveReq" data-id="${m.id}" data-team="${tid}">Chấp nhận</button></div>`; }).join('')}</div>` : '';
      panel = `<section><div class="versus">${side(m.team)}<div class="versus-mid"><em>${m.score || 'VS'}</em><small>${m.format}</small></div>${side(m.opponent)}</div>${reqs}</section>`;
    }
    return `<article class="card detail">
      <header class="hero">${courtArt(m.sport)}<div class="hero-in">
        <div><span class="stub-sport">${sportIcon(m.sport, 14)}${sp.name}</span><h2>${esc(m.title)}</h2></div>
        <div class="hero-when"><b>${F.hm(m.start)}</b><span>${F.day(m.day)}<br>đến ${F.hm(m.end)}</span></div>
      </div></header>
      <div class="detail-b">
        <div class="tags"><span class="tag ${m.type}">${m.type === 'solo' ? 'Kèo đơn' : 'Kèo đội · ' + m.format}</span>${statusTag(m)}</div>
        <dl class="facts">
          <div><dt>Sân</dt><dd><a href="#/venues/${v.id}">${esc(v.name)}</a><small>${m.court} · ${v.district}</small></dd></div>
          <div><dt>Trình độ</dt><dd>${m.level}<small>${sp.name}</small></dd></div>
          <div><dt>${m.type === 'solo' ? 'Phí mỗi người' : 'Phí mỗi đội'}</dt><dd>${F.vnd(m.fee)}<small>Trả tại sân</small></dd></div>
          <div><dt>Chủ kèo</dt><dd>${esc(host.name)}<small>Uy tín ${host.rep}% · ${host.played} trận</small></dd></div>
        </dl>
        ${m.note ? `<p class="note">${esc(m.note)}</p>` : ''}
        ${panel}
        <section><h4>Trò chuyện trong kèo <span>${chat.length}</span></h4>
          <div class="chat">${chat.length ? chat.map((c) => `<div class="msg ${c.by === ME ? 'me' : ''}">${c.by === ME ? '' : avatar(c.by, 28)}<div><small>${c.by === ME ? 'Bạn' : esc(first(D.user(c.by)))} · ${c.at}</small><p>${esc(c.text)}</p></div></div>`).join('') : '<p class="dim">Chưa có tin nhắn nào.</p>'}</div>
          ${canChat ? `<div class="chat-in"><input type="text" placeholder="Nhắn cho cả kèo…" data-model="draft" data-enter="send" data-id="${m.id}" value="${esc(S.draft)}" aria-label="Tin nhắn"><button class="btn sm" data-act="send" data-id="${m.id}" aria-label="Gửi">${icon('send', 16)}</button></div>` : '<p class="dim small">Tham gia kèo để nhắn tin với mọi người.</p>'}
        </section>
      </div>
      <footer class="detail-f">${cta(m, true)}</footer>
    </article>`;
  }

  /* ---------- Trang người chơi ---------- */
  function upcoming() {
    const ms = D.MATCHES.filter((m) => inMatch(m) && m.day >= 0 && m.status !== 'done').map((m) => ({ day: m.day, start: m.start, m }));
    return ms.sort((a, b) => a.day - b.day || a.start - b.start);
  }
  function leftCol() {
    const me = D.user(ME), teams = D.TEAMS.filter((t) => t.members.includes(ME));
    return `<a class="me-card" href="#/profile">${avatar(ME, 52)}<div><b>${me.name}</b><small>${me.area} · uy tín ${me.rep}%</small></div></a>
      <nav class="lnav">
        <a href="#/schedule">${icon('calendar')}<span>Lịch của tôi</span><i>${upcoming().length}</i></a>
        <a href="#/matches">${icon('zap')}<span>Ghép trận</span></a>
        <a href="#/venues">${icon('pin')}<span>Tìm sân</span></a>
        <a href="#/teams">${icon('shield')}<span>Đội của tôi</span></a>
        <a href="#/profile">${icon('trophy')}<span>Thành tích</span></a>
      </nav>
      <h5>Đội của tôi</h5>
      <div class="lteams">${teams.map((t) => `<a href="#/teams/${t.id}">${crest(t.id, 34)}<div><b>${esc(t.name)}</b><small>${D.sport(t.sport).name}${t.captain === ME ? ' · đội trưởng' : ''}</small></div></a>`).join('')}</div>
      <h5>Môn bạn chơi</h5>
      <div class="lsports">${Object.entries(me.levels).map(([s, l]) => `<button data-act="set" data-k="f.sport" data-v="${s}">${sportIcon(s, 18)}<span>${D.sport(s).name}</span><small>${l}</small></button>`).join('')}</div>
      <p class="foot">Giao diện mẫu, dữ liệu giả lập.<br>Dựng bởi ${MODEL}.</p>`;
  }
  function rightCol() {
    const up = upcoming().slice(0, 2);
    const near = D.VENUES.filter((v) => v.status === 'active').sort((a, b) => a.km - b.km).slice(0, 3);
    const pals = ['u2', 'u7', 'u3', 'u9', 'u6'];
    return `<section class="card side-card"><h4>Sắp ra sân</h4>
        ${up.length ? up.map(({ m }) => `<a class="next" href="#/matches/${m.id}"><div class="next-t"><b>${F.hm(m.start)}</b><small>${F.day(m.day)}</small></div><div><b>${esc(m.title)}</b><small>${sportIcon(m.sport, 13)}${esc(D.venue(m.venue).name)}</small></div></a>`).join('') : '<p class="dim small">Bạn chưa có trận nào sắp tới.</p>'}
        <a class="more" href="#/schedule">Xem toàn bộ lịch ${icon('chevR', 14)}</a></section>
      <section class="card side-card"><h4>Sân gần bạn</h4>
        ${near.map((v) => `<a class="near" href="#/venues/${v.id}"><span class="near-art">${courtArt(v.sports[0])}</span><div><b>${esc(v.name)}</b><small>${km(v)} km · ${icon('star', 12)} ${v.rating} · từ ${F.k(Math.min(...v.courts.map((c) => c.price)))}/giờ</small></div></a>`).join('')}
        <a class="more" href="#/venues">Tất cả sân ${icon('chevR', 14)}</a></section>
      <section class="card side-card"><h4>Bạn chơi quen</h4>
        ${pals.map((p) => { const u = D.user(p), s = Object.keys(u.levels)[0]; return `<div class="pal">${avatar(p, 34)}<div><b>${u.name}</b><small>${D.sport(s).name} · ${u.levels[s]}</small></div><button class="btn sm ghost" data-act="invite" data-name="${esc(first(u))}">Rủ chơi</button></div>`; }).join('')}</section>`;
  }
  function home() {
    const list = listMatches();
    return `<div class="cols3">
      <aside class="lcol ${S.drawer ? 'open' : ''}">${leftCol()}</aside>
      <main class="feed">
        <section class="card composer">
          <div class="composer-row">${avatar(ME, 44)}<button class="composer-in" data-act="create" data-type="solo">Hôm nay ra sân môn gì, ${first(D.user(ME))}?</button></div>
          <div class="composer-acts">
            <button data-act="create" data-type="solo">${icon('user')}<span><b>Tạo kèo đơn</b><small>Ghép từng người cho đủ sân</small></span></button>
            <button data-act="create" data-type="team">${icon('shield')}<span><b>Tạo kèo đội</b><small>Đội bạn tìm đội đối thủ</small></span></button>
            <a href="#/venues">${icon('pin')}<span><b>Đặt sân</b><small>Xem khung giờ còn trống</small></span></a>
          </div>
        </section>
        ${sportChips('f.sport')}
        <div class="feed-head"><h2>Kèo đang mở quanh bạn</h2>${seg('f.type', [['all', 'Tất cả'], ['solo', 'Kèo đơn'], ['team', 'Kèo đội']])}</div>
        ${list.length ? list.map((m) => matchCard(m)).join('') : empty('Chưa có kèo nào khớp', 'Thử bỏ bớt bộ lọc, hoặc tự mở một kèo để mọi người vào ghép.', `<button class="btn lime" data-act="create" data-type="solo">Tạo kèo đầu tiên</button>`)}
      </main>
      <aside class="rcol">${rightCol()}</aside>
    </div>`;
  }
  function matchesPage(id) {
    const list = listMatches(), cur = D.match(id) || list[0];
    return `<div class="page">
      <div class="page-head"><div><h1>Ghép trận</h1><p>Kèo đơn ghép từng người cho đủ sân. Kèo đội là đội gặp đội.</p></div><button class="btn lime" data-act="create" data-type="solo">${icon('plus', 18)}Tạo trận</button></div>
      <div class="fbar">${seg('f.type', [['all', 'Tất cả'], ['solo', 'Kèo đơn'], ['team', 'Kèo đội']])}
        ${select('f.level', [['all', 'Mọi trình độ'], ...D.LEVELS.map((l) => [l, l])], 'Trình độ')}
        ${select('f.day', [['all', 'Mọi ngày'], ...range(0, 7).map((d) => [d, F.day(d)])], 'Ngày')}
        <span class="count">${list.length} kèo đang mở</span></div>
      ${sportChips('f.sport')}
      <div class="md"><div class="md-list">${list.length ? list.map((m) => matchCard(m, { on: cur && m.id === cur.id, compact: true })).join('') : empty('Không có kèo nào', 'Đổi bộ lọc hoặc tạo kèo mới.')}</div>
      <div class="md-detail">${cur ? matchDetail(cur) : ''}</div></div>
    </div>`;
  }

  function freeTonight(v) {
    const day = F.nowHour() > 20 ? 1 : 0;
    let n = 0;
    v.courts.filter((c) => c.on).forEach((c) => range(17, 22).forEach((h) => { if (h < v.open[1] && D.slot(v.id, c.id, day, h) === 'free') n++; }));
    return { n, label: day ? 'tối mai' : 'tối nay' };
  }
  function venueCard(v) {
    const f = freeTonight(v), min = Math.min(...v.courts.map((c) => c.price));
    return `<a class="card vc" href="#/venues/${v.id}">
      <div class="vc-art">${courtArt(v.sports[0])}<div class="vc-sports">${v.sports.map((s) => `<span title="${D.sport(s).name}">${sportIcon(s, 16)}</span>`).join('')}</div><span class="vc-km">${km(v)} km</span></div>
      <div class="vc-b"><h3>${esc(v.name)}</h3><p class="meta">${v.district} · ${v.courts.length} ${D.sport(v.sports[0]).unit} · ${v.sports.map((s) => D.sport(s).name).join(', ')}</p>
        <div class="vc-f"><span class="rate">${icon('star', 14)}<b>${String(v.rating).replace('.', ',')}</b><small>(${v.reviews})</small></span><span>từ <b>${F.k(min)}</b>/giờ</span></div>
        <div class="vc-free ${f.n ? '' : 'none'}">${f.n ? `Còn ${f.n} khung trống ${f.label}` : `Kín lịch ${f.label}`}</div></div></a>`;
  }
  function venuesPage() {
    const q = S.q.trim().toLowerCase();
    const list = D.VENUES.filter((v) => v.status === 'active').filter((v) => S.vf.sport === 'all' || v.sports.includes(S.vf.sport))
      .filter((v) => !q || `${v.name} ${v.district} ${v.address}`.toLowerCase().includes(q)).sort((a, b) => a.km - b.km);
    return `<div class="page">
      <div class="page-head"><div><h1>Sân</h1><p>Chọn khung giờ rồi gửi yêu cầu. Chủ sân xác nhận, bạn trả tiền tại sân.</p></div><span class="count">${list.length} sân · sắp theo khoảng cách</span></div>
      ${sportChips('vf.sport')}
      ${list.length ? `<div class="vgrid">${list.map(venueCard).join('')}</div>` : empty('Không tìm thấy sân', 'Thử môn khác hoặc xoá từ khoá tìm kiếm.')}
    </div>`;
  }
  function pickGroups(v) {
    const by = {};
    S.picks.forEach((k) => { const [c, h] = k.split('@'); (by[c] = by[c] || []).push(+h); });
    const out = [];
    Object.keys(by).forEach((cid) => {
      const hs = by[cid].sort((a, b) => a - b), court = D.court(v.id, cid);
      let s = hs[0], p = hs[0], price = D.price(court, s);
      for (let i = 1; i <= hs.length; i++) {
        if (hs[i] === p + 1) { p = hs[i]; price += D.price(court, p); continue; }
        out.push({ court, start: s, end: p + 1, price });
        if (i < hs.length) { s = p = hs[i]; price = D.price(court, s); }
      }
    });
    return out;
  }
  function venuePage(id) {
    const v = D.venue(id);
    if (!v) return `<div class="page">${empty('Không tìm thấy sân', 'Sân này không tồn tại hoặc đã ngừng hoạt động.', '<a class="btn" href="#/venues">Về danh sách sân</a>')}</div>`;
    const cs = v.courts.filter((c) => c.on), groups = pickGroups(v), total = groups.reduce((s, g) => s + g.price, 0);
    const open = D.MATCHES.filter((m) => m.venue === v.id && m.day >= 0 && m.status !== 'done');
    let grid = `<div class="slots" style="--n:${cs.length}"><div class="g-corner">Giờ</div>${cs.map((c) => `<div class="g-head">${sportIcon(c.sport, 15)}<b>${esc(c.name)}</b></div>`).join('')}`;
    range(v.open[0], v.open[1]).forEach((h) => {
      grid += `<div class="g-hour">${F.hm(h)}</div>`;
      cs.forEach((c) => {
        const st = D.slot(v.id, c.id, S.day, h), key = `${c.id}@${h}`, on = S.picks.includes(key);
        if (st === 'free') grid += `<button class="g-cell free ${on ? 'on' : ''}" data-act="pick" data-key="${key}" aria-pressed="${on}" aria-label="${esc(c.name)} lúc ${F.hm(h)}">${on ? icon('check', 15) : F.k(D.price(c, h))}</button>`;
        else {
          const mine = st === 'pending' && D.BOOKINGS.some((b) => b.user === ME && b.venue === v.id && b.court === c.id && b.day === S.day && h >= b.start && h < b.end);
          grid += `<div class="g-cell ${st} ${mine ? 'mine' : ''}">${st === 'pending' ? (mine ? 'Của bạn' : 'Chờ duyệt') : st === 'booked' ? 'Đã đặt' : ''}</div>`;
        }
      });
    });
    grid += '</div>';
    return `<div class="page">
      <a class="back" href="#/venues">${icon('chevL', 16)}Tất cả sân</a>
      <header class="card vhead"><div class="vhead-art">${courtArt(v.sports[0])}</div><div class="vhead-b">
        <div class="tags">${v.sports.map((s) => `<span class="tag ghost">${sportIcon(s, 13)}${D.sport(s).name}</span>`).join('')}</div>
        <h1>${esc(v.name)}</h1><p class="meta">${icon('pin', 15)}${esc(v.address)} · cách bạn ${km(v)} km</p>
        <div class="vhead-f"><span class="rate">${icon('star', 15)}<b>${String(v.rating).replace('.', ',')}</b><small>${v.reviews} đánh giá</small></span><span>${icon('clock', 15)}Mở ${F.hm(v.open[0])}–${F.hm(v.open[1])}</span><span>Chủ sân: ${esc(D.user(v.owner).name)}</span></div>
        <div class="amen">${v.amenities.map((a) => `<span>${icon('check', 13)}${a}</span>`).join('')}</div></div></header>
      <div class="book">
        <section class="card book-main"><div class="book-top"><h2>Chọn khung giờ</h2><div class="legend"><span class="lg free">Trống</span><span class="lg on">Bạn chọn</span><span class="lg pending">Chờ duyệt</span><span class="lg booked">Đã đặt</span></div></div>
          ${dayStrip('day')}<div class="slots-wrap">${grid}</div><p class="dim small">Giá mỗi giờ. Từ 17:00 là giờ cao điểm.</p></section>
        <aside class="book-side"><section class="card sum"><h3>Yêu cầu đặt sân</h3><p class="sum-day">${F.day(S.day)}${S.day > 1 ? '' : ` · ${F.dayParts(S.day).date}/${F.dayParts(S.day).month}`}</p>
          ${groups.length ? groups.map((g) => `<div class="sum-row"><div><b>${esc(g.court.name)}</b><small>${F.range(g.start, g.end)} · ${g.end - g.start} giờ</small></div><span>${F.vnd(g.price)}</span></div>`).join('') : '<p class="dim small">Bấm vào các ô trống trong bảng để chọn. Có thể chọn nhiều giờ liền nhau.</p>'}
          ${groups.length ? `<div class="sum-total"><span>Tạm tính</span><b>${F.vnd(total)}</b></div>
            <label class="fld"><span>Lời nhắn cho chủ sân</span><textarea rows="2" data-model="note" placeholder="Ví dụ: cần thuê thêm áo bib">${esc(S.note)}</textarea></label>
            <button class="btn lime wide" data-act="book" data-id="${v.id}">Gửi yêu cầu đặt sân</button><button class="btn ghost wide" data-act="clearPicks">Bỏ chọn</button>` : ''}
          <p class="hint">${icon('clock', 14)}Chủ sân xác nhận thủ công, thường trong 15 phút. Chưa thu tiền trên ứng dụng.</p></section>
          ${open.length ? `<section class="card side-card"><h4>Kèo đang mở tại sân này</h4>${open.map((m) => `<a class="next" href="#/matches/${m.id}"><div class="next-t"><b>${F.hm(m.start)}</b><small>${F.day(m.day)}</small></div><div><b>${esc(m.title)}</b><small>${m.type === 'solo' ? `Còn ${left(m)} chỗ` : (m.opponent ? 'Đã có đối' : 'Đang tìm đối')}</small></div></a>`).join('')}</section>` : ''}
        </aside>
      </div></div>`;
  }

  function teamCard(t) {
    const mine = t.members.includes(ME), total = t.w + t.d + t.l;
    return `<a class="card tc" href="#/teams/${t.id}"><div class="tc-top">${crest(t.id, 54)}<div><h3>${esc(t.name)}</h3><p class="meta">${sportIcon(t.sport, 14)}${D.sport(t.sport).name} · ${t.area} · ${t.level}</p></div></div>
      <div class="record"><div><b>${t.w}</b><small>Thắng</small></div><div><b>${t.d}</b><small>Hòa</small></div><div><b>${t.l}</b><small>Thua</small></div><div><b>${Math.round((t.w / total) * 100)}%</b><small>Tỉ lệ thắng</small></div></div>
      <div class="tc-f"><div class="stack">${t.members.slice(0, 6).map((p) => avatar(p, 28)).join('')}${t.members.length > 6 ? `<span class="av more" style="--s:28px">+${t.members.length - 6}</span>` : ''}</div>
      ${mine ? `<span class="pill mine">${t.captain === ME ? 'Bạn là đội trưởng' : 'Thành viên'}</span>` : `<button class="btn sm ${S.teamReq[t.id] ? 'ghost' : ''}" data-act="askTeam" data-id="${t.id}">${S.teamReq[t.id] ? 'Đã xin vào' : 'Xin vào đội'}</button>`}</div></a>`;
  }
  function teamsPage() {
    const q = S.q.trim().toLowerCase(), hit = (t) => !q || `${t.name} ${t.area} ${D.sport(t.sport).name}`.toLowerCase().includes(q);
    const mine = D.TEAMS.filter((t) => t.members.includes(ME) && hit(t)), others = D.TEAMS.filter((t) => !t.members.includes(ME) && hit(t));
    return `<div class="page">
      <div class="page-head"><div><h1>Đội</h1><p>Lập đội để nhận kèo đội, theo dõi thành tích và rủ nhau ra sân.</p></div><button class="btn lime" data-act="newTeam">${icon('plus', 18)}Lập đội mới</button></div>
      <h2 class="sec">Đội của tôi <span>${mine.length}</span></h2>
      ${mine.length ? `<div class="tgrid">${mine.map(teamCard).join('')}</div>` : empty('Bạn chưa có đội', 'Lập đội mới hoặc xin vào một đội bên dưới.')}
      <h2 class="sec">Đội quanh bạn <span>${others.length}</span></h2>
      <div class="tgrid">${others.map(teamCard).join('')}</div>
    </div>`;
  }
  function teamPage(id) {
    const t = D.team(id);
    if (!t) return `<div class="page">${empty('Không tìm thấy đội', 'Đội này không tồn tại.', '<a class="btn" href="#/teams">Về danh sách đội</a>')}</div>`;
    const ms = D.MATCHES.filter((m) => m.type === 'team' && (m.team === id || m.opponent === id)).sort((a, b) => b.day - a.day), cap = t.captain === ME, total = t.w + t.d + t.l;
    return `<div class="page">
      <a class="back" href="#/teams">${icon('chevL', 16)}Tất cả đội</a>
      <header class="card thead" style="--c:${t.color}">${crest(id, 92)}<div><div class="tags"><span class="tag ghost">${sportIcon(t.sport, 13)}${D.sport(t.sport).name}</span><span class="tag ghost">${t.level}</span></div><h1>${esc(t.name)}</h1><p class="meta">${t.area} · ${t.members.length} thành viên · đội trưởng ${esc(D.user(t.captain).name)}</p></div>
        <div class="thead-a">${cap ? `<button class="btn lime" data-act="create" data-type="team" data-team="${id}">${icon('zap', 18)}Tạo kèo đội</button><button class="btn ghost" data-act="inviteMember">Mời thành viên</button>` : t.members.includes(ME) ? `<span class="pill mine">Bạn là thành viên</span>` : `<button class="btn ${S.teamReq[id] ? 'ghost' : 'lime'}" data-act="askTeam" data-id="${id}">${S.teamReq[id] ? 'Đã xin vào' : 'Xin vào đội'}</button>`}</div></header>
      <div class="split">
        <div><div class="tiles"><div class="tile"><small>Thắng</small><b>${t.w}</b></div><div class="tile"><small>Hòa</small><b>${t.d}</b></div><div class="tile"><small>Thua</small><b>${t.l}</b></div><div class="tile lime"><small>Tỉ lệ thắng</small><b>${Math.round((t.w / total) * 100)}%</b></div></div>
          <h2 class="sec">Trận của đội <span>${ms.length}</span></h2>
          ${ms.length ? ms.map((m) => matchCard(m)).join('') : empty('Chưa có trận nào', cap ? 'Tạo kèo đội để tìm đối thủ.' : 'Đội trưởng chưa mở kèo nào.')}</div>
        <section class="card side-card"><h4>Đội hình <span>${t.members.length}</span></h4>
          ${t.members.map((p) => { const u = D.user(p); return `<div class="pal">${avatar(p, 36)}<div><b>${esc(u.name)}${p === ME ? ' (bạn)' : ''}</b><small>${u.levels[t.sport] || 'Chưa xếp hạng'} · ${u.played} trận</small></div>${p === t.captain ? '<span class="tag ghost">Đội trưởng</span>' : ''}</div>`; }).join('')}</section>
      </div></div>`;
  }

  const B_STATUS = { pending: ['Chờ chủ sân xác nhận', 'warn'], confirmed: ['Đã xác nhận', 'ok'], rejected: ['Bị từ chối', 'bad'], cancelled: ['Đã huỷ', ''] };
  function schedulePage() {
    const ms = D.MATCHES.filter(inMatch).map((m) => ({ kind: 'm', day: m.day, start: m.start, m }));
    const bs = D.BOOKINGS.filter((b) => b.user === ME).map((b) => ({ kind: 'b', day: b.day, start: b.start, b }));
    const all = [...ms, ...bs], dead = (x) => x.kind === 'b' && (x.b.status === 'rejected' || x.b.status === 'cancelled');
    const tabs = {
      upcoming: all.filter((x) => x.day >= 0 && !dead(x)),
      pending: all.filter((x) => x.day >= 0 && ((x.kind === 'b' && x.b.status === 'pending') || (x.kind === 'm' && x.m.type === 'team' && !x.m.opponent))),
      past: all.filter((x) => x.day < 0 || dead(x)),
    };
    const list = tabs[S.sched].sort((a, b) => (S.sched === 'past' ? b.day - a.day : a.day - b.day) || a.start - b.start);
    const days = [...new Set(list.map((x) => x.day))];
    const item = (x) => {
      if (x.kind === 'm') { const m = x.m, v = D.venue(m.venue); return `<a class="si" href="#/matches/${m.id}"><div class="si-t"><b>${F.hm(m.start)}</b><small>${F.hm(m.end)}</small></div><span class="si-ic" style="--c:${D.sport(m.sport).color}">${sportIcon(m.sport, 18)}</span><div class="si-b"><b>${esc(m.title)}</b><small>${m.type === 'solo' ? 'Kèo đơn' : 'Kèo đội'} · ${esc(v.name)} · ${m.court}</small></div>${statusTag(m)}${m.score ? `<span class="pill">${m.score}</span>` : ''}</a>`; }
      const b = x.b, v = D.venue(b.venue), c = D.court(b.venue, b.court), st = B_STATUS[b.status];
      return `<div class="si"><div class="si-t"><b>${F.hm(b.start)}</b><small>${F.hm(b.end)}</small></div><span class="si-ic" style="--c:${D.sport(c.sport).color}">${icon('pin', 18)}</span><div class="si-b"><b>Đặt sân · <a href="#/venues/${v.id}">${esc(v.name)}</a></b><small>${esc(c.name)} · ${F.vnd(b.price)}${b.match ? ' · cho kèo “' + esc(D.match(b.match).title) + '”' : ''}</small></div><span class="tag ${st[1]}">${st[0]}</span>${b.day >= 0 && (b.status === 'pending' || b.status === 'confirmed') ? `<button class="btn sm ghost" data-act="cancelBooking" data-id="${b.id}">Huỷ</button>` : ''}</div>`;
    };
    return `<div class="page narrow">
      <div class="page-head"><div><h1>Lịch của tôi</h1><p>Mọi trận bạn tham gia và mọi yêu cầu đặt sân của bạn.</p></div></div>
      ${seg('sched', [['upcoming', 'Sắp tới', tabs.upcoming.length], ['pending', 'Đang chờ', tabs.pending.length], ['past', 'Đã qua', tabs.past.length]])}
      ${days.length ? days.map((d) => `<section class="sday"><h3>${F.day(d)}${Math.abs(d) <= 1 ? `<small>${F.dayParts(d).date}/${F.dayParts(d).month}</small>` : ''}</h3><div class="card">${list.filter((x) => x.day === d).map(item).join('')}</div></section>`).join('') : empty('Chưa có gì ở đây', 'Tham gia một kèo hoặc đặt sân để lịch của bạn có việc.', '<a class="btn lime" href="#/matches">Tìm kèo</a>')}
    </div>`;
  }
  function profilePage() {
    const me = D.user(ME), done = D.MATCHES.filter((m) => m.status === 'done' && inMatch(m)), lvIdx = (l) => D.LEVELS.indexOf(l) + 1;
    return `<div class="page narrow">
      <header class="card phead">${avatar(ME, 88)}<div><h1>${me.name}</h1><p class="meta">${icon('pin', 15)}${me.area} · tham gia từ ${me.joined}</p></div><button class="btn ghost" data-act="demo" data-msg="Bản mẫu: chưa mở chỉnh sửa hồ sơ.">Sửa hồ sơ</button></header>
      <div class="tiles"><div class="tile"><small>Trận đã chơi</small><b>${me.played}</b></div><div class="tile lime"><small>Điểm uy tín</small><b>${me.rep}%</b></div><div class="tile"><small>Đội</small><b>${myTeamIds().length}</b></div><div class="tile"><small>Lần bỏ kèo</small><b>1</b></div></div>
      <div class="split even"><section class="card side-card"><h4>Môn và trình độ</h4>${Object.entries(me.levels).map(([s, l]) => `<div class="lvl"><span class="si-ic" style="--c:${D.sport(s).color}">${sportIcon(s, 18)}</span><div><b>${D.sport(s).name}</b><div class="lvl-bar">${[1, 2, 3, 4].map((i) => `<i class="${i <= lvIdx(l) ? 'on' : ''}"></i>`).join('')}</div></div><small>${l}</small></div>`).join('')}</section>
      <section class="card side-card"><h4>Trận gần đây</h4>${done.map((m) => `<a class="next" href="#/matches/${m.id}"><div class="next-t"><b>${m.score}</b><small>${F.day(m.day)}</small></div><div><b>${esc(m.title)}</b><small>${sportIcon(m.sport, 13)}${esc(D.venue(m.venue).name)}</small></div></a>`).join('')}</section></div>
    </div>`;
  }

  /* ---------- Kênh chủ sân ---------- */
  const myVenues = () => D.VENUES.filter((v) => v.owner === OWNER);
  const oBookings = () => D.BOOKINGS.filter((b) => D.venue(b.venue).owner === OWNER);
  const reqRow = (b, actions = true) => { const u = D.user(b.user), v = D.venue(b.venue), c = D.court(b.venue, b.court), st = B_STATUS[b.status];
    return `<div class="req"><div class="req-who">${avatar(b.user, 40)}<div><b>${esc(u.name)}</b><small class="${u.rep < 70 ? 'bad' : ''}">Uy tín ${u.rep}% · ${u.played} trận</small></div></div>
      <div class="req-what"><b>${esc(c.name)}</b><small>${esc(v.name)}</small></div>
      <div class="req-when"><b>${F.range(b.start, b.end)}</b><small>${F.day(b.day)} · gửi ${b.ago.toLowerCase()}</small></div>
      <div class="req-price"><b>${F.vnd(b.price)}</b>${b.note ? `<small title="${esc(b.note)}">“${esc(b.note)}”</small>` : b.reason ? `<small>${esc(b.reason)}</small>` : ''}</div>
      <div class="req-act">${b.status === 'pending' && actions ? `<button class="btn sm ghost" data-act="rejectB" data-id="${b.id}">Từ chối</button><button class="btn sm lime" data-act="approveB" data-id="${b.id}">Xác nhận</button>` : `<span class="tag ${st[1]}">${b.status === 'pending' ? 'Chờ duyệt' : st[0]}</span>`}</div></div>`; };
  const bars = (vals, labels, unit) => { const max = Math.max(...vals); return `<div class="bars">${vals.map((v, i) => `<div class="bar ${i === vals.length - 1 ? 'on' : ''}"><span>${String(v).replace('.', ',')}${unit}</span><i style="height:${Math.round((v / max) * 100)}%"></i><small>${labels[i]}</small></div>`).join('')}</div>`; };
  const last7 = () => range(-6, 1).map((d) => (d === 0 ? 'Nay' : F.dayParts(d).dow));

  function ownerOverview() {
    const bs = oBookings(), pend = bs.filter((b) => b.status === 'pending' && b.day >= 0), today = bs.filter((b) => b.day === 0 && b.status === 'confirmed');
    const rev = today.reduce((s, b) => s + b.price, 0), courts = myVenues().filter((v) => v.status === 'active').flatMap((v) => v.courts.filter((c) => c.on).map((c) => ({ v, c })));
    const hoursBooked = today.reduce((s, b) => s + (b.end - b.start), 0), fill = Math.round((hoursBooked / (courts.length * 8)) * 100);
    const now = F.nowHour(), pos = (h) => ((h - 5) / 18) * 100;
    return `<div class="page-head"><div><h1>Chào anh ${first(D.user(OWNER))}</h1><p>${F.day(0)}, ${F.dayParts(0).date}/${F.dayParts(0).month}. ${pend.length ? `Có ${pend.length} yêu cầu đang chờ anh xác nhận.` : 'Không còn yêu cầu nào chờ xử lý.'}</p></div><a class="btn lime" href="#/owner/requests">${icon('inbox', 18)}Xử lý yêu cầu</a></div>
      <div class="tiles"><div class="tile ${pend.length ? 'warn' : ''}"><small>Yêu cầu chờ duyệt</small><b>${pend.length}</b></div><div class="tile"><small>Lượt đặt hôm nay</small><b>${today.length}</b></div><div class="tile lime"><small>Doanh thu hôm nay</small><b>${F.k(rev)}</b></div><div class="tile"><small>Lấp đầy giờ vàng</small><b>${Math.min(fill, 100)}%</b></div></div>
      <section class="card pad"><div class="sec-row"><h2>Lịch hôm nay</h2><a class="more" href="#/owner/calendar">Mở lịch sân ${icon('chevR', 14)}</a></div>
        <div class="gantt"><div class="gantt-axis"><span></span><div>${range(5, 24).filter((h) => h % 2 === 1).map((h) => `<i style="left:${pos(h)}%">${h}h</i>`).join('')}</div></div>
        ${courts.map(({ v, c }) => `<div class="gantt-row"><span>${sportIcon(c.sport, 14)}<b>${esc(c.name)}</b><small>${esc(v.name.replace('Sân bóng ', '').replace('Tổ hợp ', ''))}</small></span><div class="track">${now > 5 && now < 23 ? `<u style="left:${pos(now)}%"></u>` : ''}${bs.filter((b) => b.venue === v.id && b.court === c.id && b.day === 0 && (b.status === 'confirmed' || b.status === 'pending')).map((b) => `<em class="${b.status}" style="left:${pos(b.start)}%;width:${pos(b.end) - pos(b.start)}%" title="${esc(D.user(b.user).name)} · ${F.range(b.start, b.end)}">${esc(first(D.user(b.user)))}</em>`).join('')}</div></div>`).join('')}</div>
        <div class="legend"><span class="lg booked">Đã xác nhận</span><span class="lg pending">Chờ duyệt</span><span class="lg now">Bây giờ</span></div></section>
      <div class="split even"><section class="card pad"><div class="sec-row"><h2>Yêu cầu mới nhất</h2><a class="more" href="#/owner/requests">Tất cả ${icon('chevR', 14)}</a></div>
        ${pend.length ? pend.slice(0, 3).map((b) => { const u = D.user(b.user), c = D.court(b.venue, b.court); return `<div class="pal">${avatar(b.user, 36)}<div><b>${esc(u.name)}</b><small>${esc(c.name)} · ${F.day(b.day)} ${F.range(b.start, b.end)}</small></div><button class="btn sm lime" data-act="approveB" data-id="${b.id}">Xác nhận</button></div>`; }).join('') : '<p class="dim small">Đã xử lý hết.</p>'}</section>
      <section class="card pad"><div class="sec-row"><h2>Doanh thu 7 ngày</h2><small class="dim">triệu đồng</small></div>${bars(D.STATS.ownerRevenue, last7(), '')}</section></div>`;
  }
  function ownerRequests() {
    const bs = oBookings(), g = { pending: bs.filter((b) => b.status === 'pending'), confirmed: bs.filter((b) => b.status === 'confirmed'), rejected: bs.filter((b) => b.status === 'rejected' || b.status === 'cancelled') };
    const list = g[S.o.tab].sort((a, b) => a.day - b.day || a.start - b.start);
    return `<div class="page-head"><div><h1>Yêu cầu đặt sân</h1><p>Người chơi gửi yêu cầu, anh xác nhận hoặc từ chối. Khung giờ được giữ tạm trong lúc chờ.</p></div></div>
      ${seg('o.tab', [['pending', 'Chờ duyệt', g.pending.length], ['confirmed', 'Đã xác nhận', g.confirmed.length], ['rejected', 'Từ chối / huỷ', g.rejected.length]])}
      <section class="card reqs-table"><div class="req head"><span>Người đặt</span><span>Sân</span><span>Thời gian</span><span>Thành tiền</span><span></span></div>
      ${list.length ? list.map((b) => reqRow(b)).join('') : empty('Trống', 'Không có yêu cầu nào trong mục này.')}</section>`;
  }
  function ownerCalendar() {
    const vs = myVenues().filter((v) => v.status === 'active'), v = D.venue(S.o.venue) || vs[0], cs = v.courts, bs = oBookings().filter((b) => b.venue === v.id && b.day === S.o.day && (b.status === 'confirmed' || b.status === 'pending'));
    let g = `<div class="cal" style="--n:${cs.length}"><div class="g-corner" style="grid-row:1;grid-column:1">Giờ</div>${cs.map((c, i) => `<div class="g-head ${c.on ? '' : 'off'}" style="grid-row:1;grid-column:${i + 2}">${sportIcon(c.sport, 15)}<b>${esc(c.name)}</b>${c.on ? '' : '<small>Tạm ngưng</small>'}</div>`).join('')}`;
    range(v.open[0], v.open[1]).forEach((h) => {
      const r = h - v.open[0] + 2;
      g += `<div class="g-hour" style="grid-row:${r};grid-column:1">${F.hm(h)}</div>`;
      cs.forEach((c, i) => {
        const b = bs.find((x) => x.court === c.id && h >= x.start && h < x.end), key = `${v.id}|${c.id}|${S.o.day}|${h}`, col = `grid-column:${i + 2}`;
        if (b) { if (h === b.start) g += `<div class="blk ${b.status}" style="grid-row:${r}/span ${b.end - b.start};${col}"><b>${esc(D.user(b.user).name)}</b><small>${F.range(b.start, b.end)} · ${F.k(b.price)}</small>${b.status === 'pending' ? `<button class="btn sm lime" data-act="approveB" data-id="${b.id}">Xác nhận</button>` : ''}</div>`; }
        else if (!c.on) g += `<div class="g-cell past" style="grid-row:${r};${col}"></div>`;
        else if (D.LOCKS[key]) g += `<button class="g-cell locked" style="grid-row:${r};${col}" data-act="lock" data-key="${key}" title="Bấm để mở khoá">${icon('lock', 14)}Khoá</button>`;
        else g += `<button class="g-cell free owner" style="grid-row:${r};${col}" data-act="lock" data-key="${key}" title="Bấm để khoá khung này">Trống</button>`;
      });
    });
    return `<div class="page-head"><div><h1>Lịch sân</h1><p>Bấm vào ô trống để khoá khung giờ (bảo trì, giữ cho khách quen). Bấm lần nữa để mở.</p></div></div>
      <div class="fbar">${seg('o.venue', vs.map((x) => [x.id, x.name]))}</div>
      <section class="card book-main"><div class="book-top">${dayStrip('o.day')}<div class="legend"><span class="lg booked">Đã xác nhận</span><span class="lg pending">Chờ duyệt</span><span class="lg locked">Đã khoá</span></div></div><div class="slots-wrap">${g}</div></div></section>`;
  }
  function ownerCourts() {
    return `<div class="page-head"><div><h1>Sân của tôi</h1><p>Quản lý cụm sân, sân con, bảng giá và tình trạng hoạt động.</p></div><button class="btn lime" data-act="demo" data-msg="Bản mẫu: hồ sơ sân mới sẽ được gửi cho quản trị duyệt.">${icon('plus', 18)}Đăng ký sân mới</button></div>
      ${myVenues().map((v) => `<section class="card ov"><header><span class="near-art">${courtArt(v.sports[0])}</span><div><h2>${esc(v.name)}</h2><p class="meta">${esc(v.address)}</p></div>${v.status === 'active' ? `<span class="rate">${icon('star', 15)}<b>${String(v.rating).replace('.', ',')}</b><small>${v.reviews} đánh giá</small></span><span class="tag ok">Đang hoạt động</span>` : `<span class="tag ${v.status === 'pending' ? 'warn' : 'bad'}">${v.status === 'pending' ? 'Chờ quản trị duyệt' : 'Bị từ chối'}</span>`}</header>
        <table class="tbl"><thead><tr><th>Sân con</th><th>Môn</th><th class="r">Giá thường</th><th class="r">Giá cao điểm</th><th class="r">Nhận đặt</th></tr></thead><tbody>
        ${v.courts.map((c) => `<tr><td><b>${esc(c.name)}</b></td><td><span class="inl">${sportIcon(c.sport, 15)}${D.sport(c.sport).name}</span></td><td class="r">${F.vnd(c.price)}</td><td class="r">${F.vnd(c.peak)}</td><td class="r"><button class="sw ${c.on ? 'on' : ''}" role="switch" aria-checked="${c.on}" aria-label="Nhận đặt ${esc(c.name)}" data-act="toggleCourt" data-v="${v.id}" data-c="${c.id}"><i></i></button></td></tr>`).join('')}</tbody></table></section>`).join('')}`;
  }
  function ownerRevenue() {
    const bs = oBookings().filter((b) => b.status === 'confirmed'), rows = myVenues().filter((v) => v.status === 'active').flatMap((v) => v.courts.map((c) => { const mine = bs.filter((b) => b.venue === v.id && b.court === c.id); return { v, c, n: mine.length, h: mine.reduce((s, b) => s + b.end - b.start, 0), sum: mine.reduce((s, b) => s + b.price, 0) }; })).sort((a, b) => b.sum - a.sum);
    const total = rows.reduce((s, r) => s + r.sum, 0), week = D.STATS.ownerRevenue.reduce((s, x) => s + x, 0);
    return `<div class="page-head"><div><h1>Doanh thu</h1><p>Tính trên các lượt đặt đã xác nhận. Khách trả tiền tại sân.</p></div></div>
      <div class="tiles"><div class="tile lime"><small>7 ngày qua</small><b>${String(week.toFixed(1)).replace('.', ',')} tr</b></div><div class="tile"><small>Lượt đã xác nhận</small><b>${bs.length}</b></div><div class="tile"><small>Giá trị các lượt này</small><b>${F.k(total)}</b></div><div class="tile"><small>Lấp đầy trung bình</small><b>${Math.round(D.STATS.ownerFill.reduce((s, x) => s + x, 0) / 7)}%</b></div></div>
      <div class="split even"><section class="card pad"><div class="sec-row"><h2>Doanh thu theo ngày</h2><small class="dim">triệu đồng</small></div>${bars(D.STATS.ownerRevenue, last7(), '')}</section>
      <section class="card pad"><div class="sec-row"><h2>Tỉ lệ lấp đầy</h2><small class="dim">% giờ có khách</small></div>${bars(D.STATS.ownerFill, last7(), '%')}</section></div>
      <section class="card"><table class="tbl"><thead><tr><th>Sân con</th><th>Cụm sân</th><th class="r">Lượt đặt</th><th class="r">Số giờ</th><th class="r">Doanh thu</th></tr></thead><tbody>${rows.map((r) => `<tr><td><span class="inl">${sportIcon(r.c.sport, 15)}<b>${esc(r.c.name)}</b></span></td><td>${esc(r.v.name)}</td><td class="r">${r.n}</td><td class="r">${r.h}</td><td class="r"><b>${F.vnd(r.sum)}</b></td></tr>`).join('')}</tbody></table></section>`;
  }

  /* ---------- Quản trị ---------- */
  const ROLE = { player: 'Người chơi', owner: 'Chủ sân', admin: 'Quản trị' };
  function adminOverview() {
    const k = D.STATS.adminKpi, pendV = D.VENUES.filter((v) => v.status === 'pending').length, openR = D.REPORTS.filter((r) => r.status === 'open').length;
    const delta = (n) => `<em class="${n >= 0 ? 'up' : 'down'}">${n >= 0 ? '+' : ''}${String(n).replace('.', ',')}%</em>`;
    return `<div class="page-head"><div><h1>Tổng quan hệ thống</h1><p>Số liệu 7 ngày gần nhất, so với 7 ngày trước đó.</p></div></div>
      <div class="tiles"><div class="tile"><small>Người dùng ${delta(k.usersDelta)}</small><b>${k.users.toLocaleString('vi-VN')}</b></div><div class="tile"><small>Sân hoạt động ${delta(k.venuesDelta)}</small><b>${k.venues}</b></div><div class="tile lime"><small>Trận ghép trong tuần ${delta(k.matchesDelta)}</small><b>${k.matches}</b></div><div class="tile"><small>Kèo ghép đủ người ${delta(k.fillDelta)}</small><b>${k.fill}%</b></div></div>
      <div class="queue"><a class="card qcard ${pendV ? 'warn' : ''}" href="#/admin/venues">${icon('store', 22)}<div><b>${pendV} hồ sơ sân chờ duyệt</b><small>Chủ sân chỉ nhận đặt sau khi được duyệt</small></div>${icon('chevR', 18)}</a><a class="card qcard ${openR ? 'bad' : ''}" href="#/admin/reports">${icon('flag', 22)}<div><b>${openR} báo cáo vi phạm đang mở</b><small>Bùng kèo, sai giá, ngôn từ</small></div>${icon('chevR', 18)}</a></div>
      <div class="split even"><section class="card pad"><div class="sec-row"><h2>Trận ghép theo tuần</h2><small class="dim">12 tuần gần nhất</small></div>${bars(D.STATS.adminMatches, D.STATS.adminMatches.map((_, i) => (i === 11 ? 'Nay' : i % 2 ? '' : `T-${11 - i}`)), '')}</section>
      <section class="card pad"><div class="sec-row"><h2>Tỉ trọng theo môn</h2><small class="dim">% số trận</small></div><div class="share">${D.SPORTS.map((s) => `<div><span class="inl">${sportIcon(s.id, 15)}${s.name}</span><div class="share-bar"><i style="width:${D.STATS.sportShare[s.id] * 2.6}%;background:${s.color}"></i></div><b>${D.STATS.sportShare[s.id]}%</b></div>`).join('')}</div></section></div>
      <section class="card pad"><div class="sec-row"><h2>Hoạt động gần đây</h2></div><div class="acts">${D.ACTIVITY.map((a) => `<div><i></i><p>${a.text}</p><small>${a.ago} trước</small></div>`).join('')}</div></section>`;
  }
  function adminUsers() {
    const q = S.a.q.trim().toLowerCase(), list = D.USERS.filter((u) => (S.a.role === 'all' || u.role === S.a.role) && (!q || `${u.name} ${u.area}`.toLowerCase().includes(q)));
    return `<div class="page-head"><div><h1>Người dùng</h1><p>Tra cứu, xem điểm uy tín và khoá tài khoản vi phạm.</p></div></div>
      <div class="fbar"><label class="search inline">${icon('search', 18)}<input type="search" placeholder="Tìm theo tên hoặc khu vực" data-model="a.q" data-live value="${esc(S.a.q)}" aria-label="Tìm người dùng"></label>${seg('a.role', [['all', 'Tất cả'], ['player', 'Người chơi'], ['owner', 'Chủ sân'], ['admin', 'Quản trị']])}<span class="count">${list.length} tài khoản</span></div>
      <section class="card"><table class="tbl"><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Khu vực</th><th class="r">Số trận</th><th class="r">Uy tín</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      ${list.map((u) => `<tr class="${u.status === 'locked' ? 'muted' : ''}"><td><span class="inl">${avatar(u.id, 32)}<span><b>${esc(u.name)}</b><small>Tham gia ${u.joined}</small></span></span></td><td>${ROLE[u.role]}</td><td>${u.area}</td><td class="r">${u.role === 'player' ? u.played : '—'}</td><td class="r">${u.role === 'player' ? `<b class="${u.rep < 70 ? 'bad' : ''}">${u.rep}%</b>` : '—'}</td><td><span class="tag ${u.status === 'active' ? 'ok' : 'bad'}">${u.status === 'active' ? 'Hoạt động' : 'Đã khoá'}</span></td><td class="r">${u.role === 'admin' ? '' : `<button class="btn sm ghost" data-act="lockUser" data-id="${u.id}">${u.status === 'active' ? 'Khoá' : 'Mở khoá'}</button>`}</td></tr>`).join('') || `<tr><td colspan="7">${empty('Không có ai khớp', 'Thử từ khoá khác.')}</td></tr>`}</tbody></table></section>`;
  }
  function adminVenues() {
    const pend = D.VENUES.filter((v) => v.status === 'pending'), rest = D.VENUES.filter((v) => v.status !== 'pending');
    return `<div class="page-head"><div><h1>Duyệt sân</h1><p>Kiểm tra hồ sơ trước khi sân xuất hiện với người chơi.</p></div></div>
      <h2 class="sec">Chờ duyệt <span>${pend.length}</span></h2>
      ${pend.length ? `<div class="vgrid two">${pend.map((v) => `<section class="card pv"><div class="pv-top"><span class="near-art">${courtArt(v.sports[0])}</span><div><h3>${esc(v.name)}</h3><p class="meta">${esc(v.address)}</p></div></div>
        <dl class="facts"><div><dt>Chủ sân</dt><dd>${esc(D.user(v.owner).name)}<small>Gửi ${v.submitted.toLowerCase()}</small></dd></div><div><dt>Quy mô</dt><dd>${v.courts.length} sân con<small>${v.sports.map((s) => D.sport(s).name).join(', ')}</small></dd></div><div><dt>Giá</dt><dd>${F.k(Math.min(...v.courts.map((c) => c.price)))} – ${F.k(Math.max(...v.courts.map((c) => c.peak)))}<small>mỗi giờ</small></dd></div></dl>
        <div class="amen">${v.docs.map((d) => `<span>${icon('check', 13)}${d}</span>`).join('')}${v.docs.length < 3 ? `<span class="miss">${icon('x', 13)}Thiếu giấy phép hoặc bảng giá</span>` : ''}</div>
        <div class="pv-act"><button class="btn ghost" data-act="rejectV" data-id="${v.id}">Từ chối</button><button class="btn lime" data-act="approveV" data-id="${v.id}">Duyệt sân</button></div></section>`).join('')}</div>` : empty('Không còn hồ sơ nào', 'Mọi hồ sơ đã được xử lý.')}
      <h2 class="sec">Tất cả sân <span>${rest.length}</span></h2>
      <section class="card"><table class="tbl"><thead><tr><th>Sân</th><th>Chủ sân</th><th>Môn</th><th class="r">Sân con</th><th class="r">Đánh giá</th><th>Trạng thái</th></tr></thead><tbody>${rest.map((v) => `<tr><td><b>${esc(v.name)}</b><small>${v.district}</small></td><td>${esc(D.user(v.owner).name)}</td><td><span class="inl">${v.sports.map((s) => sportIcon(s, 15)).join('')}</span></td><td class="r">${v.courts.length}</td><td class="r">${v.reviews ? String(v.rating).replace('.', ',') : 'Mới'}</td><td><span class="tag ${v.status === 'active' ? 'ok' : 'bad'}">${v.status === 'active' ? 'Hoạt động' : 'Đã từ chối'}</span></td></tr>`).join('')}</tbody></table></section>`;
  }
  function adminReports() {
    const tname = (r) => (r.kind === 'user' ? D.user(r.target).name : r.kind === 'venue' ? D.venue(r.target).name : `Kèo “${D.match(r.target).title}”`);
    const open = D.REPORTS.filter((r) => r.status === 'open'), done = D.REPORTS.filter((r) => r.status !== 'open');
    const card = (r) => `<section class="card rp-card ${r.status}"><header><span class="tag ${r.status === 'open' ? 'bad' : 'ghost'}">${r.type}</span><small>${r.ago}</small></header>
      <h3>${esc(tname(r))}${r.kind === 'user' ? `<small>Uy tín ${D.user(r.target).rep}%</small>` : ''}</h3><p>${esc(r.text)}</p><p class="dim small">Người báo cáo: ${esc(D.user(r.by).name)}</p>
      ${r.status === 'open' ? `<div class="pv-act"><button class="btn sm ghost" data-act="resolve" data-id="${r.id}" data-res="Bỏ qua">Bỏ qua</button><button class="btn sm ghost" data-act="resolve" data-id="${r.id}" data-res="Đã cảnh cáo">Cảnh cáo</button><button class="btn sm danger" data-act="resolve" data-id="${r.id}" data-res="${r.kind === 'user' ? 'Đã khoá tài khoản' : 'Đã gỡ nội dung'}">${r.kind === 'user' ? 'Khoá tài khoản' : 'Gỡ nội dung'}</button></div>` : `<span class="pill ok">${icon('check', 14)}${r.result}</span>`}</section>`;
    return `<div class="page-head"><div><h1>Báo cáo vi phạm</h1><p>Người chơi và chủ sân gửi báo cáo. Mỗi quyết định được ghi lại.</p></div></div>
      <h2 class="sec">Đang mở <span>${open.length}</span></h2>${open.length ? `<div class="vgrid two">${open.map(card).join('')}</div>` : empty('Không còn báo cáo nào', 'Hàng đợi đã trống.')}
      <h2 class="sec">Đã xử lý <span>${done.length}</span></h2><div class="vgrid two">${done.map(card).join('')}</div>`;
  }
  function adminSports() {
    return `<div class="page-head"><div><h1>Môn thể thao</h1><p>Bật hoặc tắt một môn trên toàn hệ thống. Môn đã tắt không hiện trong bộ lọc của người chơi.</p></div></div>
      <section class="card"><table class="tbl"><thead><tr><th>Môn</th><th class="r">Sân hỗ trợ</th><th class="r">Kèo đang mở</th><th class="r">Đội</th><th class="r">Tỉ trọng</th><th class="r">Hiển thị</th></tr></thead><tbody>
      ${D.SPORTS.map((s) => `<tr class="${s.on ? '' : 'muted'}"><td><span class="inl"><span class="si-ic" style="--c:${s.color}">${sportIcon(s.id, 18)}</span><b>${s.name}</b></span></td><td class="r">${D.VENUES.filter((v) => v.sports.includes(s.id)).length}</td><td class="r">${D.MATCHES.filter((m) => m.sport === s.id && m.status !== 'done').length}</td><td class="r">${D.TEAMS.filter((t) => t.sport === s.id).length}</td><td class="r">${D.STATS.sportShare[s.id]}%</td><td class="r"><button class="sw ${s.on ? 'on' : ''}" role="switch" aria-checked="${s.on}" aria-label="Hiển thị ${s.name}" data-act="toggleSport" data-id="${s.id}"><i></i></button></td></tr>`).join('')}</tbody></table></section>`;
  }

  function dash(r) {
    const owner = S.role === 'owner', pend = oBookings().filter((b) => b.status === 'pending').length;
    const nav = owner
      ? [['overview', 'Tổng quan', 'grid'], ['requests', 'Yêu cầu đặt sân', 'inbox', pend], ['calendar', 'Lịch sân', 'calendar'], ['courts', 'Sân của tôi', 'store'], ['revenue', 'Doanh thu', 'chart']]
      : [['overview', 'Tổng quan', 'grid'], ['users', 'Người dùng', 'users'], ['venues', 'Duyệt sân', 'store', D.VENUES.filter((v) => v.status === 'pending').length], ['reports', 'Báo cáo vi phạm', 'flag', D.REPORTS.filter((x) => x.status === 'open').length], ['sports', 'Môn thể thao', 'ball']];
    const pages = owner ? { overview: ownerOverview, requests: ownerRequests, calendar: ownerCalendar, courts: ownerCourts, revenue: ownerRevenue } : { overview: adminOverview, users: adminUsers, venues: adminVenues, reports: adminReports, sports: adminSports };
    const sub = pages[r.id] ? r.id : 'overview', u = D.user(who());
    return `<div class="dash"><aside class="side ${S.drawer ? 'open' : ''}"><div class="side-who">${avatar(u.id, 40)}<div><b>${u.name}</b><small>${owner ? `${myVenues().length} cụm sân` : 'Quản trị viên'}</small></div></div>
      <nav>${nav.map(([k, l, ic, n]) => `<a class="${sub === k ? 'on' : ''}" href="#/${S.role}/${k}">${icon(ic)}<span>${l}</span>${n ? `<i>${n}</i>` : ''}</a>`).join('')}</nav>
      <p class="foot">Giao diện mẫu, dữ liệu giả lập.<br>Dựng bởi ${MODEL}.</p></aside>
      <main class="dash-main">${pages[sub]()}</main></div>`;
  }

  /* ---------- Khung trang ---------- */
  function route() { const p = location.hash.replace(/^#\/?/, '').split('/'); return { page: p[0] || 'home', id: p[1] }; }
  function topbar(r) {
    const tabs = [['home', 'Trang chủ', 'home'], ['matches', 'Ghép trận', 'zap'], ['venues', 'Sân', 'pin'], ['teams', 'Đội', 'shield'], ['schedule', 'Lịch', 'calendar']];
    const unread = D.NOTIFS[S.role].filter((n) => n.unread).length, player = S.role === 'player';
    return `<header class="top"><div class="top-l"><button class="ib menu-btn" data-act="drawer" aria-label="Mở menu">${icon('menu')}</button>
        <a class="logo" href="${homeOf()}" aria-label="Ra Sân, về trang đầu"><i></i>RA SÂN</a>
        ${player ? `<label class="search">${icon('search', 18)}<input type="search" placeholder="Tìm kèo, sân, đội…" data-model="q" data-live data-search value="${esc(S.q)}" aria-label="Tìm kiếm"></label>` : ''}</div>
      <nav class="top-c">${player ? tabs.map(([k, l, ic]) => `<a class="${r.page === k ? 'on' : ''}" href="#/${k}" title="${l}">${icon(ic, 22)}<span>${l}</span></a>`).join('') : `<span class="role-pill">${icon(S.role === 'owner' ? 'store' : 'shield', 16)}${S.role === 'owner' ? 'Kênh chủ sân' : 'Trang quản trị'}</span>`}</nav>
      <div class="top-r">${player ? `<button class="btn lime" data-act="create" data-type="solo">${icon('plus', 18)}<span>Tạo trận</span></button><button class="ib ${S.pop === 'chat' ? 'on' : ''}" data-act="pop" data-pop="chat" aria-label="Tin nhắn">${icon('chat')}</button>` : ''}
        <button class="ib ${S.pop === 'notif' ? 'on' : ''}" data-act="pop" data-pop="notif" aria-label="Thông báo, ${unread} chưa đọc">${icon('bell')}${unread ? `<i>${unread}</i>` : ''}</button>
        <button class="me-btn ${S.pop === 'me' ? 'on' : ''}" data-act="pop" data-pop="me" aria-label="Tài khoản và vai trò">${avatar(who(), 36)}${icon('chevD', 14)}</button></div></header>`;
  }
  function popover() {
    if (S.pop === 'notif') { const ns = D.NOTIFS[S.role]; return `<div class="pop wide"><header><h3>Thông báo</h3><button class="link" data-act="readAll">Đánh dấu đã đọc</button></header>${ns.map((n) => `<a class="nt ${n.unread ? 'unread' : ''}" href="${n.to}"><span class="nt-ic ${n.tone}">${icon(n.icon, 18)}</span><div><p>${n.text}</p><small>${n.ago} trước</small></div></a>`).join('')}</div>`; }
    if (S.pop === 'chat') { const ids = Object.keys(D.CHATS).filter((id) => D.CHATS[id].length); return `<div class="pop wide"><header><h3>Tin nhắn</h3></header>${ids.map((id) => { const m = D.match(id), c = D.CHATS[id][D.CHATS[id].length - 1]; return `<a class="nt" href="#/matches/${id}"><span class="nt-ic" style="background:${D.sport(m.sport).color};color:#fff">${sportIcon(m.sport, 18)}</span><div><p><b>${esc(m.title)}</b></p><small>${c.by === ME ? 'Bạn' : esc(first(D.user(c.by)))}: ${esc(c.text)}</small></div></a>`; }).join('')}</div>`; }
    if (S.pop === 'me') { const rs = [['player', ME, 'Người chơi', 'Ghép kèo, đặt sân, lập đội'], ['owner', OWNER, 'Chủ sân', 'Xác nhận đặt sân, quản lý lịch'], ['admin', ADMIN, 'Quản trị', 'Duyệt sân, xử lý báo cáo']];
      return `<div class="pop"><header><h3>Xem thử theo vai trò</h3></header>${rs.map(([k, id, l, d]) => `<button class="role ${S.role === k ? 'on' : ''}" data-act="role" data-role="${k}">${avatar(id, 36)}<div><b>${l}</b><small>${D.user(id).name} · ${d}</small></div>${S.role === k ? icon('check', 18) : ''}</button>`).join('')}<p class="foot">Bản web · dựng bởi ${MODEL}</p></div>`; }
    return '';
  }
  function modal() {
    if (!S.modal) return '';
    let body = '';
    if (S.modal === 'create') {
      const f = S.form, solo = f.type === 'solo', vs = D.VENUES.filter((v) => v.status === 'active' && v.sports.includes(f.sport)), caps = capTeams(f.sport);
      const opt = (arr, cur) => arr.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
      body = `<header><h2>Tạo trận mới</h2><button class="ib" data-act="close" aria-label="Đóng">${icon('x')}</button></header>
        <div class="modal-b"><div class="type-pick"><button class="${solo ? 'on' : ''}" data-act="formSet" data-k="type" data-v="solo">${icon('user', 22)}<b>Kèo đơn</b><small>Bạn mở kèo, từng người vào ghép cho đủ</small></button><button class="${solo ? '' : 'on'}" data-act="formSet" data-k="type" data-v="team">${icon('shield', 22)}<b>Kèo đội</b><small>Đội của bạn tìm một đội đối thủ</small></button></div>
          <div class="fld"><span>Môn</span><div class="chips tight">${sportsOn().map((s) => `<button class="chip ${f.sport === s.id ? 'on' : ''}" data-act="formSet" data-k="sport" data-v="${s.id}">${sportIcon(s.id, 16)}${s.name}</button>`).join('')}</div></div>
          ${solo ? '' : `<div class="fgrid"><label class="fld"><span>Đội của bạn</span>${caps.length ? `<select data-form="team">${opt(caps.map((t) => [t.id, t.name]), f.team)}</select>` : `<p class="warnbox">Bạn chưa là đội trưởng đội ${D.sport(f.sport).name} nào. Hãy lập đội trước.</p>`}</label><label class="fld"><span>Thể thức</span><input type="text" data-form="format" value="${esc(f.format)}" placeholder="5 vs 5"></label></div>`}
          <label class="fld"><span>Tiêu đề</span><input type="text" data-form="title" value="${esc(f.title)}" placeholder="${solo ? 'Ví dụ: Đánh đôi giao lưu tối thứ năm' : 'Ví dụ: Tìm đối đá sân 5, đá vui'}" maxlength="70"></label>
          <label class="fld"><span>Sân</span><select data-form="venue">${opt(vs.map((v) => [v.id, `${v.name} · ${v.district}`]), f.venue)}</select><small>Tạo trận chưa giữ sân. Hãy gửi yêu cầu đặt sân ở trang sân.</small></label>
          <div class="fgrid three"><label class="fld"><span>Ngày</span><select data-form="day" data-num>${opt(range(0, 7).map((d) => [d, F.day(d)]), f.day)}</select></label><label class="fld"><span>Bắt đầu</span><select data-form="start" data-num>${opt(range(10, 45).map((x) => [x / 2, F.hm(x / 2)]), f.start)}</select></label><label class="fld"><span>Thời lượng</span><select data-form="dur" data-num>${opt([[1, '1 giờ'], [1.5, '1 giờ 30'], [2, '2 giờ']], f.dur)}</select></label></div>
          <div class="fgrid three">${solo ? `<label class="fld"><span>Tổng số người</span><input type="number" min="2" max="22" data-form="slots" data-num value="${f.slots}"></label>` : ''}<label class="fld"><span>Trình độ</span><select data-form="level">${opt(D.LEVELS.map((l) => [l, l]), f.level)}</select></label><label class="fld"><span>${solo ? 'Phí mỗi người' : 'Phí mỗi đội'} (đ)</span><input type="number" min="0" step="5000" data-form="fee" data-num value="${f.fee}"></label></div>
          <label class="fld"><span>Ghi chú</span><textarea rows="2" data-form="note" placeholder="Luật chơi, đồ cần mang, cách chia tiền…">${esc(f.note)}</textarea></label></div>
        <footer><button class="btn ghost" data-act="close">Huỷ</button><button class="btn lime" data-act="submitCreate" ${!solo && !caps.length ? 'disabled' : ''}>Đăng kèo</button></footer>`;
    } else if (S.modal === 'team') {
      const f = S.form;
      body = `<header><h2>Lập đội mới</h2><button class="ib" data-act="close" aria-label="Đóng">${icon('x')}</button></header>
        <div class="modal-b"><label class="fld"><span>Tên đội</span><input type="text" data-form="name" value="${esc(f.name)}" placeholder="Ví dụ: FC Hẻm 42" maxlength="40"></label>
        <div class="fld"><span>Môn</span><div class="chips tight">${sportsOn().map((s) => `<button class="chip ${f.sport === s.id ? 'on' : ''}" data-act="formSet" data-k="sport" data-v="${s.id}">${sportIcon(s.id, 16)}${s.name}</button>`).join('')}</div></div>
        <div class="fgrid"><label class="fld"><span>Khu vực</span><input type="text" data-form="area" value="${esc(f.area)}"></label><label class="fld"><span>Trình độ</span><select data-form="level">${D.LEVELS.map((l) => `<option ${f.level === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div></div>
        <footer><button class="btn ghost" data-act="close">Huỷ</button><button class="btn lime" data-act="submitTeam">Lập đội</button></footer>`;
    } else if (S.modal === 'booked') {
      body = `<div class="modal-b done"><span class="done-ic">${icon('check', 30)}</span><h2>Đã gửi yêu cầu đặt sân</h2><p>Chủ sân sẽ xác nhận trong ít phút. Khung giờ của bạn đang được giữ tạm. Bạn trả tiền tại sân.</p></div>
        <footer><button class="btn ghost" data-act="close">Ở lại trang sân</button><a class="btn lime" href="#/schedule" data-act="closeGo">Xem lịch của tôi</a></footer>`;
    }
    return `<div class="scrim" data-act="close"></div><div class="modal ${S.modal}" role="dialog" aria-modal="true">${body}</div>`;
  }
  function view(r) {
    if (S.role !== 'player') return dash(r);
    const pages = { home, matches: () => matchesPage(r.id), venues: () => (r.id ? venuePage(r.id) : venuesPage()), teams: () => (r.id ? teamPage(r.id) : teamsPage()), schedule: schedulePage, profile: profilePage };
    return (pages[r.page] || home)();
  }
  function render() {
    const a = document.activeElement, key = a && (a.dataset.model || a.dataset.form), sel = key && a.selectionStart;
    const r = route();
    const floatNav = S.drawer && S.role === 'player' && r.page !== 'home' ? `<aside class="lcol open float">${leftCol()}</aside>` : '';
    $('#app').innerHTML = topbar(r) + view(r) + floatNav + (S.drawer ? '<div class="scrim drawer-scrim" data-act="drawer"></div>' : '');
    $('#layer').innerHTML = popover() + modal();
    document.body.classList.toggle('lock', !!S.modal);
    if (key) { const el = $(`[data-model="${key}"],[data-form="${key}"]`); if (el) { el.focus(); try { el.setSelectionRange(sel, sel); } catch (e) { /* ô không hỗ trợ */ } } }
  }

  /* ---------- Hành động ---------- */
  const A = {
    go: (d) => { location.hash = d.to; },
    set: (d) => { setPath(d.k, d.num ? +d.v : d.v); if (d.reset) S[d.reset] = []; render(); },
    pop: (d) => { S.pop = S.pop === d.pop ? null : d.pop; render(); },
    drawer: () => { S.drawer = !S.drawer; render(); },
    close: () => { S.modal = null; S.form = null; render(); },
    closeGo: () => { S.modal = null; },
    role: (d) => { S.role = d.role; S.pop = null; S.q = ''; if (location.hash === homeOf()) render(); else location.hash = homeOf(); toast(`Đang xem với vai trò ${ROLE[d.role].toLowerCase()}`); },
    readAll: () => { D.NOTIFS[S.role].forEach((n) => { n.unread = false; }); render(); },
    demo: (d) => toast(d.msg),
    share: () => toast('Đã chép đường dẫn kèo'),
    invite: (d) => toast(`Đã gửi lời rủ chơi tới ${d.name}`),
    inviteMember: () => toast('Đã chép đường dẫn mời vào đội'),
    join: (d) => { const m = D.match(d.id); m.players.push(ME); toast(`Đã vào kèo. Hẹn bạn ${F.hm(m.start)} ${F.day(m.day).toLowerCase()} tại ${D.venue(m.venue).name}`); render(); },
    leave: (d) => { const m = D.match(d.id); m.players = m.players.filter((p) => p !== ME); toast('Bạn đã rời kèo'); render(); },
    accept: (d) => { const m = D.match(d.id), t = capTeams(m.sport)[0];
      if (!t) return toast(`Chỉ đội trưởng mới nhận kèo đội. Bạn chưa là đội trưởng đội ${D.sport(m.sport).name} nào.`, 'bad');
      m.requests.push(t.id); toast(`${t.name} đã gửi lời nhận kèo. Chờ ${D.team(m.team).name} chấp nhận.`); render(); },
    withdraw: (d) => { const m = D.match(d.id); m.requests = m.requests.filter((t) => D.team(t).captain !== ME); toast('Đã rút lời nhận kèo'); render(); },
    approveReq: (d) => { const m = D.match(d.id); m.opponent = d.team; m.requests = []; m.status = 'matched'; toast(`Đã chốt đối: ${D.team(d.team).name}`); render(); },
    declineReq: (d) => { const m = D.match(d.id); m.requests = m.requests.filter((t) => t !== d.team); toast('Đã từ chối lời nhận kèo'); render(); },
    send: (d) => { const t = S.draft.trim(); if (!t) return; const n = new Date(); (D.CHATS[d.id] = D.CHATS[d.id] || []).push({ by: ME, text: t, at: F.hm(n.getHours() + n.getMinutes() / 60) }); S.draft = ''; render(); },
    pick: (d) => { const i = S.picks.indexOf(d.key); if (i >= 0) S.picks.splice(i, 1); else S.picks.push(d.key); render(); },
    clearPicks: () => { S.picks = []; render(); },
    book: (d) => { const v = D.venue(d.id);
      pickGroups(v).forEach((g) => D.BOOKINGS.push({ id: 'b' + (D.BOOKINGS.length + 1), venue: v.id, court: g.court.id, day: S.day, start: g.start, end: g.end, user: ME, status: 'pending', price: g.price, ago: 'Vừa xong', note: S.note.trim() }));
      S.picks = []; S.note = ''; S.modal = 'booked'; render(); },
    cancelBooking: (d) => { D.booking(d.id).status = 'cancelled'; toast('Đã huỷ yêu cầu đặt sân'); render(); },
    askTeam: (d, el, e) => { e.preventDefault(); S.teamReq[d.id] = !S.teamReq[d.id]; toast(S.teamReq[d.id] ? `Đã gửi lời xin vào ${D.team(d.id).name}` : 'Đã rút lời xin vào đội'); render(); },
    create: (d) => { const t = d.team && D.team(d.team), sport = t ? t.sport : (S.f.sport !== 'all' ? S.f.sport : 'badminton');
      S.form = { type: d.type || 'solo', sport, team: d.team || '', format: '5 vs 5', title: '', venue: '', day: 0, start: 19, dur: 1.5, slots: 4, level: 'Trung bình', fee: 50000, note: '' };
      S.modal = 'create'; S.pop = null; render(); },
    newTeam: () => { S.form = { name: '', sport: 'football', area: D.user(ME).area, level: 'Trung bình' }; S.modal = 'team'; render(); },
    formSet: (d) => { S.form[d.k] = d.v; if (d.k === 'sport') { S.form.venue = ''; S.form.team = ''; } render(); },
    submitCreate: () => { const f = S.form, solo = f.type === 'solo';
      if (!f.title.trim()) return toast('Hãy đặt tiêu đề cho kèo', 'bad');
      const venue = f.venue || (D.VENUES.find((v) => v.status === 'active' && v.sports.includes(f.sport)) || {}).id;
      if (!venue) return toast('Chưa có sân nào cho môn này', 'bad');
      const team = solo ? null : f.team || (capTeams(f.sport)[0] || {}).id, id = 'm' + (D.MATCHES.length + 1);
      D.MATCHES.push({ id, type: f.type, sport: f.sport, title: f.title.trim(), venue, court: 'Chưa đặt sân', day: f.day, start: f.start, end: f.start + f.dur, level: f.level, fee: f.fee || 0, host: ME, note: f.note.trim(), status: 'open',
        ...(solo ? { slots: Math.max(2, f.slots || 2), players: [ME] } : { team, opponent: null, format: f.format || 'Tự do', requests: [] }) });
      S.modal = null; S.form = null; S.f = { sport: 'all', type: 'all', level: 'all', day: 'all' }; S.q = ''; toast('Đã đăng kèo. Mọi người quanh bạn sẽ thấy ngay.'); location.hash = `#/matches/${id}`; },
    submitTeam: () => { const f = S.form; if (!f.name.trim()) return toast('Hãy đặt tên đội', 'bad');
      const id = 't' + (D.TEAMS.length + 1), w = f.name.trim().split(/\s+/);
      D.TEAMS.push({ id, name: f.name.trim(), tag: ((w[w.length - 2] || w[0])[0] + w[w.length - 1][0]).toUpperCase(), sport: f.sport, color: D.sport(f.sport).color, captain: ME, area: f.area || 'TP.HCM', level: f.level, w: 0, d: 0, l: 0, members: [ME] });
      S.modal = null; S.form = null; toast('Đã lập đội. Mời thêm thành viên nhé.'); location.hash = `#/teams/${id}`; },
    approveB: (d) => { const b = D.booking(d.id); b.status = 'confirmed'; toast(`Đã xác nhận cho ${D.user(b.user).name}, ${F.range(b.start, b.end)}`); render(); },
    rejectB: (d) => { const b = D.booking(d.id); b.status = 'rejected'; b.reason = 'Chủ sân từ chối.'; toast('Đã từ chối yêu cầu'); render(); },
    lock: (d) => { if (D.LOCKS[d.key]) delete D.LOCKS[d.key]; else D.LOCKS[d.key] = true; render(); },
    toggleCourt: (d) => { const c = D.court(d.v, d.c); c.on = !c.on; toast(`${c.name}: ${c.on ? 'nhận đặt trở lại' : 'tạm ngưng nhận đặt'}`); render(); },
    lockUser: (d) => { const u = D.user(d.id); u.status = u.status === 'active' ? 'locked' : 'active'; toast(`${u.status === 'active' ? 'Đã mở khoá' : 'Đã khoá'} tài khoản ${u.name}`); render(); },
    approveV: (d) => { const v = D.venue(d.id); v.status = 'active'; toast(`Đã duyệt ${v.name}`); render(); },
    rejectV: (d) => { const v = D.venue(d.id); v.status = 'rejected'; toast(`Đã từ chối hồ sơ ${v.name}`); render(); },
    resolve: (d) => { const r = D.REPORTS.find((x) => x.id === d.id); r.status = 'resolved'; r.result = d.res; if (d.res === 'Đã khoá tài khoản') D.user(r.target).status = 'locked'; toast(`Báo cáo đã xử lý: ${d.res.toLowerCase()}`); render(); },
    toggleSport: (d) => { const s = D.sport(d.id); s.on = !s.on; toast(`${s.name}: ${s.on ? 'đang hiển thị' : 'đã ẩn với người chơi'}`); render(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (S.pop && !e.target.closest('.pop') && !(el && el.dataset.act === 'pop')) { S.pop = null; if (!el) return render(); }
    if (el && A[el.dataset.act]) A[el.dataset.act](el.dataset, el, e);
  });
  document.addEventListener('input', (e) => {
    const el = e.target, num = (v) => (el.dataset.num !== undefined ? +v : v);
    if (el.dataset.form) { S.form[el.dataset.form] = num(el.value); return; }
    if (!el.dataset.model) return;
    setPath(el.dataset.model, num(el.value));
    if (el.dataset.search !== undefined && !['home', 'matches', 'venues', 'teams'].includes(route().page)) { location.hash = '#/matches'; return; }
    if (el.dataset.live !== undefined) render();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (S.modal || S.pop || S.drawer)) { S.modal = null; S.pop = null; S.drawer = false; S.form = null; render(); }
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter) A[e.target.dataset.enter](e.target.dataset);
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('article[data-act]')) { e.preventDefault(); A.go(e.target.dataset); }
  });
  let last = route();
  window.addEventListener('hashchange', () => {
    const r = route(), owns = r.page === 'owner' || r.page === 'admin';
    if (owns && S.role !== r.page) S.role = r.page;
    if (!owns && S.role !== 'player') S.role = 'player';
    if (r.page !== last.page || r.id !== last.id) { S.picks = []; S.day = 0; S.draft = ''; }
    S.pop = null; S.drawer = false;
    render();
    if (!(r.page === 'matches' && last.page === 'matches')) window.scrollTo(0, 0);
    last = r;
  });

  const r0 = route();
  if (r0.page === 'owner' || r0.page === 'admin') S.role = r0.page;
  if (!location.hash) history.replaceState(null, '', homeOf());
  render();
})();
