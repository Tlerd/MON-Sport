---
version: alpha
name: MONSPORT
description: Court booking and pick-up matches for Vietnamese badminton and football players. White surfaces on a light green-gray canvas, one court-green accent for every primary action, one family (Be Vietnam Pro), status shown as icon plus word. The phone app behaves like the Facebook app — the top bar and the floating tab bar hide on scroll down and come back on scroll up. The web is a work tool for owners and a planning screen for players.

colors:
  primary: "#0F7B53"
  on-primary: "#FFFFFF"
  ink: "#16201B"
  ink-muted: "#5B6660"
  canvas: "#EEF1EF"
  surface: "#FFFFFF"
  line: "#DCE2DE"
  peak: "#C98A00"
  focus: "#7FC4A8"
  status-wait: "#A15C00"
  status-wait-bg: "#FFF3E0"
  status-ok: "#0F7B53"
  status-ok-bg: "#E3F4EC"
  status-no: "#B42318"
  status-no-bg: "#FDECEA"
  status-off: "#5B6660"
  status-off-bg: "#EEF1EF"

typography:
  title-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 22px
    fontWeight: 700
    lineHeight: 28px
  title-web:
    fontFamily: Be Vietnam Pro
    fontSize: 28px
    fontWeight: 700
    lineHeight: 34px
  headline-mobile:
    fontFamily: Be Vietnam Pro
    fontSize: 17px
    fontWeight: 700
    lineHeight: 22px
  headline-web:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: 700
    lineHeight: 24px
  body:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: 400
    lineHeight: 21px
  body-strong:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: 600
    lineHeight: 21px
  meta:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: 400
    lineHeight: 18px
  label:
    fontFamily: Be Vietnam Pro
    fontSize: 13px
    fontWeight: 600
    lineHeight: 16px
  numeric:
    fontFamily: Be Vietnam Pro
    fontSize: 15px
    fontWeight: 600
    lineHeight: 21px
    fontFeature: "tnum"

rounded:
  none: 0px
  sm: 8px
  md: 12px
  lg: 16px
  full: 999px

spacing:
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px

components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
  text-muted:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.meta}"
  divider:
    backgroundColor: "{colors.line}"
    height: 1px
  focus-ring:
    backgroundColor: "{colors.focus}"
    size: 3px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
    height: 44px
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    padding: 12px 16px
    height: 44px
  icon-button:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    size: 40px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: 0 12px
    height: 44px
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 12px
    height: 34px
  chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 12px
    height: 34px
  badge-wait:
    backgroundColor: "{colors.status-wait-bg}"
    textColor: "{colors.status-wait}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 8px
    height: 24px
  badge-ok:
    backgroundColor: "{colors.status-ok-bg}"
    textColor: "{colors.status-ok}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 8px
    height: 24px
  badge-no:
    backgroundColor: "{colors.status-no-bg}"
    textColor: "{colors.status-no}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 8px
    height: 24px
  badge-off:
    backgroundColor: "{colors.status-off-bg}"
    textColor: "{colors.status-off}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: 0 8px
    height: 24px
  slot:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    width: 64px
    height: 48px
  slot-taken:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    width: 64px
    height: 48px
  slot-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    width: 64px
    height: 48px
  peak-marker:
    backgroundColor: "{colors.peak}"
    height: 3px
  card-mobile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: 14px 16px
  card-web:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: 20px
  topbar-mobile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    height: 52px
  tabbar-mobile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.full}"
    height: 60px
  tab-active:
    backgroundColor: "{colors.status-ok-bg}"
    textColor: "{colors.primary}"
    rounded: "{rounded.full}"
    height: 48px
  actionbar-mobile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 10px 10px 10px 16px
  sheet-mobile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: 16px
  topnav-web:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.body-strong}"
    height: 60px
  topnav-web-active:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body-strong}"
    height: 60px
  sidebar-web:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.body-strong}"
    width: 220px
  sidebar-item-active:
    backgroundColor: "{colors.status-ok-bg}"
    textColor: "{colors.primary}"
    typography: "{typography.body-strong}"
    rounded: "{rounded.sm}"
    height: 42px
  count-badge:
    backgroundColor: "{colors.status-no}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    size: 16px
  price-total:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.numeric}"
---

# MONSPORT design standard

Every screen in `apps/mobile` follows this file. Since ADR 0009, `apps/web` follows `docs/design/web-ui-v3/` and `apps/web/src/app/theme.css`, and still follows the section "Words". The YAML front matter holds the tokens for `apps/mobile`, and it is the only source of mobile token values. The sections below explain how to use them. The file follows the DESIGN.md format of Google Labs (`version: alpha`). `AGENTS.md` and the skill `agent-workflow` hold the workflow.

Plans and mockups: `docs/design/`. Decision on the mobile app: `docs/adr/0006-app-mobile-pwa.md`.

## Overview

MONSPORT has two products. They share one system but not one layout.

| Product | Folder | Device | Who uses it |
|---|---|---|---|
| Web | `apps/web` | Desktop and laptop, 1024px and wider. Must also work well at 390px wide (intake: "Web, dùng tốt ở màn rộng 390px") | Owners at the counter, the admin, players who plan on a large screen |
| Mobile app | `apps/mobile` | Phone, 360px to 430px, installed as a PWA | Players first, owners on the move |

Both products use the same tokens, icons, words, and API contract (`packages/shared`). Do not make one responsive layout that serves both.

The character is a lit court at night: a calm white and gray surface, and one court-green accent that marks what you can do next. Information is short. A row is one fact; a chip is an icon and one word.

Principles:

1. **One screen, one job.** A screen answers one question: "Which hour is free?", "Which requests wait for me?". Do not stack unrelated blocks on one page.
2. **Icon plus short word, never a sentence.** Show sport, status, and price as a chip or a row, not as a paragraph.
3. **Content first, chrome second.** On the phone, the bars hide while the user reads, and come back when the user scrolls up.
4. **The next action is always in reach.** The primary button of a flow is fixed at the bottom of the phone, or in the right pane of the web.
5. **Same word, same thing.** Use the terms of the table "Tên gọi" in the intake. A button and its result use the same verb: "Gửi yêu cầu" makes "Đã gửi yêu cầu".

## Colors

- `{colors.primary}` is the only accent. It marks primary buttons, the selected chip, the selected slot, and the active tab or sidebar item. Do not use it for decoration.
- `{colors.canvas}` is the page behind cards, as in a feed. `{colors.surface}` is every card, bar, sheet, and panel.
- `{colors.ink}` is text. `{colors.ink-muted}` is secondary text and icons at rest.
- `{colors.peak}` marks peak hours (17:00–22:00) and nothing else.
- The status colors are for booking and match status only, as badges. A status color is never a button color.

| Status | Component | Icon |
|---|---|---|
| Chờ xác nhận | `badge-wait` | clock |
| Đã xác nhận, trận Mở | `badge-ok` | check, users |
| Bị từ chối, errors | `badge-no` | x |
| Hết hạn, Đã hủy, trận Đầy | `badge-off` | minus, lock |
| Trận Đã đá xong, trận Đã hủy | `badge-off` | check-circle, minus |

Text contrast is 4.5:1 or more. Dark mode is not in scope for the first version.

## Typography

- One family: Be Vietnam Pro, weights 400, 600, and 700. It was drawn for Vietnamese diacritics. Do not add a second family.
- Mobile uses `title-mobile` and `headline-mobile`. Web uses `title-web` and `headline-web`. Both use `body`, `body-strong`, `meta`, and `label`.
- Prices, times, and counts use `{typography.numeric}`, which turns on tabular figures.
- Sentence case everywhere. No all-caps labels.

## Layout

### Spacing

Use the `spacing` scale only. The gap between cards is `{spacing.sm}` on mobile and `{spacing.base}` on web. The inner padding of a card is `{spacing.base}` on mobile and 20px on web.

### Mobile app shell

```
┌──────────────────────────────┐
│ monsport         (+)  (🔍)   │  topbar-mobile, hides on scroll down
├──────────────────────────────┤
│ [T7 24/10] [CN 25/10] [...]  │  context bar (optional), sticks under the top bar
│                              │
│   content (feed or list)     │
│                              │
│ ┌──────────────────────────┐ │
│ │ Sân 1 · 20:00  [Gửi y/c] │ │  actionbar-mobile (only during a flow)
│ └──────────────────────────┘ │
│  ( ⌂   ◷   ☰   🔔   ◉ )      │  tabbar-mobile, floating, hides on scroll down
└──────────────────────────────┘
```

Scroll behavior, as in the Facebook app:

| Event | Top bar | Context bar | Tab bar | Action bar |
|---|---|---|---|---|
| Scroll down more than 8px | Slides up out of view | Moves up to `top: 0` and stays | Slides down out of view | Moves down to the bottom safe area and stays |
| Scroll up more than 8px | Slides back | Moves back under the top bar | Slides back | Moves back above the tab bar |
| At the top of the page (scrollY < 52) | Shown | Shown | Shown | Shown |
| At the end of the page | Unchanged | Unchanged | Shown | Shown |
| A sheet, menu, or keyboard is open | Frozen | Frozen | Hidden | Shown above the keyboard |

- Animate with `transform: translateY()` only, 200ms, `cubic-bezier(.2,.8,.2,1)`. Never animate `height` or `top`.
- Under `prefers-reduced-motion: reduce`, the bars do not slide. They stay shown.
- Implement the rule once, as the hook `useHideOnScroll` in `apps/mobile/src/hooks/`, with one test for each row of the table.
- Pad content with `env(safe-area-inset-*)`. The tab bar floats 12px above the bottom safe area, at 92% opacity with a backdrop blur.

Tabs by role:

| Role | Tabs (left to right) |
|---|---|
| Người dùng (kể cả chưa đăng nhập) | Đặt sân · Phòng chờ · Lịch của tôi · Thông báo · Tôi |
| Owner | Yêu cầu (count) · Lịch sân · Doanh thu · Thông báo · Tôi |
| Admin | Not on the mobile app. Show "Dùng web để quản trị" and a link |

- Each tab keeps its own scroll position and its own stack of screens.
- A detail screen opens on top of its tab with a back arrow, and hides the tab bar.
- Forms open as a `sheet-mobile` from the bottom: booking a slot, phone booking, opening a match.

### Web shell

| Role | Navigation | Content |
|---|---|---|
| Người dùng (kể cả chưa đăng nhập) | `topnav-web` with 3 links: Đặt sân, Phòng chờ, Lịch của tôi. Bell and account menu on the right | 1280px wide at most, centered |
| Owner | `sidebar-web`: Yêu cầu (count), Lịch sân, Doanh thu, Đơn vị và giá. Venue switcher at the bottom | Full width; the schedule grid needs it |
| Admin | `sidebar-web`: Tổng quan, Chủ sân, Đơn vị và sân | Tables with a right panel for create and edit |

Each screen has its own URL. A notification links to the screen of its object, for example `/chu-san/yeu-cau/:id`.

Layout patterns:

- **List and detail** (Phòng chờ, Yêu cầu): the list takes 40% on the left, and the detail takes the rest. A click does not leave the list.
- **Three panes** (Đặt sân): venues on the left (300px), the slot grid in the middle, and the summary with the primary button on the right (320px). The summary does not scroll away.
- **Courts by hours** (Đặt sân, Lịch sân): one row per court, one column per 30 minutes. Both screens use the same component, with a read-only mode for players.
- **Table and panel** (admin): the panel opens on the right, and the table stays visible.

## Elevation & Depth

- Cards have no shadow. They sit on `{colors.canvas}`, and the color step is the depth.
- Only things that float above content have a shadow: the mobile tab bar, the action bar, a sheet, a menu, a panel. Use one shadow: `0 8px 24px -8px rgba(10,30,20,.3)` plus a 1px ring at 6% ink.
- A sheet dims the page behind it with ink at 40%.

## Shapes

| Token | Use |
|---|---|
| `{rounded.none}` | Mobile feed cards, edge to edge as in a feed |
| `{rounded.sm}` | Buttons, inputs, slots, sidebar items |
| `{rounded.md}` | Web cards and panels |
| `{rounded.lg}` | Sheets (top corners), the action bar |
| `{rounded.full}` | Chips, badges, icon buttons, the mobile tab bar, avatars |

### Icons

- One outline set: Lucide, 1.75px stroke, 20px in lists and 24px in bars. Import single icons. Do not load an icon font.
- Sport icons are custom SVGs in `packages/shared/icons` (to create): `IconBadminton` (shuttlecock) and `IconFootball` (ball). Each sport has one icon and one short name: "Cầu lông", "Bóng đá".
- A sport is shown as a chip with the icon and the short name. In a dense row (slot list, match card), show the icon alone with an `aria-label`.
- Status is always icon plus word. Never color alone.
- Never use an emoji as an icon.

## Components

Build each component once per product, in `src/components/`, before a feature needs a copy of it. The token entries above give the colors and sizes; this list gives the behavior.

| Component | Tokens | Behavior |
|---|---|---|
| `Chip` | `chip`, `chip-selected` | Icon plus short word. Toggles on tap |
| `StatusBadge` | `badge-wait`, `badge-ok`, `badge-no`, `badge-off` | Status icon plus word |
| `SlotGrid` | `slot`, `slot-taken`, `slot-selected`, `peak-marker` | Courts by 30-minute cells. Free cells are buttons. A taken cell is struck through and is not focusable. Peak cells carry `peak-marker` on their top edge. Arrow keys move between cells. Each free hour offers "Gọi chủ sân" (UC-2): the selected free cell shows it in the `ActionBar` (mobile) or the summary pane (web), next to "Gửi yêu cầu". On mobile, each court is one horizontal row. On web, see "Time windows" below |
| `ActionBar` | `actionbar-mobile`, `button-primary`, `price-total` | The fixed primary action of a flow, with the price on the left. For a selected free slot it also holds a secondary "Gọi chủ sân" action that dials the owner (UC-2) |
| `Sheet` (mobile) | `sheet-mobile` | Bottom sheet with a grabber, a title, and one primary button. Focus trap. Closes on swipe down and on Escape |
| `Panel` (web) | `card-web` | Right panel. Focus trap. Closes on Escape |
| `Card` | `card-mobile`, `card-web` | 3 lines at most; the rest goes to the detail screen. A match card always shows the price per suất and the label "Đã xác nhận" or "Chưa xác nhận" (UC-7). When the match is full, it shows "Đầy" next to that label, not in its place |
| `EmptyState` | `text-muted`, `button-primary` | One sentence and one button: "Chưa có booking. Đặt sân" |
| `TabBar` (mobile) | `tabbar-mobile`, `tab-active`, `count-badge` | Tabs of the role. Hides with `useHideOnScroll` |
| `TopBar` (mobile) | `topbar-mobile`, `icon-button` | Logo or back arrow on the left, at most 3 icon buttons on the right |
| `TopNav` (web) | `topnav-web`, `topnav-web-active` | Player navigation |
| `Sidebar` (web) | `sidebar-web`, `sidebar-item-active`, `count-badge` | Owner and admin navigation. 72px icon rail from 768px to 1023px |

Every interactive component shows `focus-ring` on keyboard focus.

### Time windows

A day from 06:00 to 23:00 has 34 cells of 30 minutes. One row of 34 cells is too long to read, and it pushes the page sideways. So `SlotGrid` never shows the whole day at once.

- Split the day into three windows, cut to the opening hours of the venue: **Sáng** (opening to 12:00), **Chiều** (12:00 to 17:00), **Tối** (17:00 to closing). The number of cells in a window follows the opening hours of the đơn vị: at most 12 cells for Sáng, 10 for Chiều, and 12 for Tối, and fewer when the venue opens later or closes earlier. A window that has no open hour is hidden.
- A selection may continue across a window edge. For example, 16:30–17:30 crosses Chiều and Tối. The selection stays when the user switches window. The summary shows the whole range.
- Show the windows as chips above the grid, with short hours: "Tối 17–23". In pick mode, each chip adds its number of free hours: "Tối 17–23 · 4 giờ trống". In manage mode, it adds the number of pending requests: "Tối 17–23 · 2 chờ".
- The first window shown: for today, the window that holds the current time. For another day, Tối, because peak hours are booked most.
- Cells stretch to fill the width (`minmax(28px, 1fr)`). An hour label sits above every second cell.
- For today, cells before the current time are disabled.
- The grid never makes the page scroll sideways. Every flex or grid parent of the grid has `min-width: 0`.
- Below 1280px, a window chip shows only its name and hours. The count moves to the chip `title` and `aria-label`, so the three chips stay on one line.
- Mobile app: each court keeps one horizontal row of the whole day. The window chips sit above the rows and scroll every row to the start of the window; they do not filter. On open, the rows start at the first window shown (the rule above), not at the opening hour.

### Words

- A row holds one fact per line.
- Price: "120k" in lists and chips, "120.000đ" in the summary and on the receipt.
- Time: "20:00–21:00". Date: "T7 24/10" in chips, "Thứ Bảy, 24/10/2026" in headers.
- A notice is one sentence. Move a longer explanation into a help sheet behind an info icon. Texts that the intake requires are exempt and appear in full.
- The Đặt sân screen and the Đơn vị screen (web and mobile) show the UC-2 notice in full: "App mới ra mắt. Hãy gọi chủ sân và xem kỹ thông tin trước khi đặt."
- An empty state says what to do next.

## Do's and Don'ts

### Do

- Keep `{colors.primary}` for the next action and the current selection.
- Show the sport as `IconBadminton` or `IconFootball`, with the short name when there is room.
- Put the primary action of a flow in `ActionBar` on mobile, and in the right pane on web.
- Split a long page into screens with their own URL.
- Use `{typography.numeric}` for every price, time, and count.

### Don't

- Don't stack unrelated blocks on one page, and don't use one long page per role.
- Don't write a raw hex value, font size, radius, or shadow in a component. Take it from the tokens.
- Don't use a status color for a button, or `{colors.status-no}` for anything but errors, rejected requests, and the count badge.
- Don't use emoji icons, all-caps labels, or a second font family.
- Don't put a long form in the middle of a mobile page. Use a sheet.
- Don't add a shadow to a card that does not float.

## Responsive Behavior

| Width | Product | Key changes |
|---|---|---|
| < 360px | Mobile app | Not designed. Must not overflow horizontally |
| 360–430px | Mobile app | The target. Tab bar, hide on scroll, sheets |
| All widths (360–1440px+) | Web | See [docs/design/web-responsive.md](docs/design/web-responsive.md) |

- Touch targets are 44px or more on mobile.
- On mobile, the slot row of a court scrolls sideways. The page never scrolls sideways.

## Iteration Guide

1. Read the front matter first. Name tokens and components by their key: `{colors.primary}`, `slot-selected`.
2. Add a new state as a new `components` entry, such as `slot-hover`. Do not describe it only in prose.
3. After an edit, run the linter. It must report 0 errors:
   ```
   npx -p @google/design.md designmd lint DESIGN.md
   ```
4. Generate the CSS custom properties from this file. Do not type them by hand. `npx -p @google/design.md designmd export --format dtcg DESIGN.md` gives the tokens as JSON. A script turns that JSON into `src/app/tokens.css` of each product (web plan, step 1).
5. A screen is done when:
   - it follows the layout of its product and the scroll table;
   - it has no raw hex value, no emoji icon, and no all-caps label;
   - it was checked at 390px, 1024px and 1440px for the web (and at 390px for the mobile app);
   - keyboard focus is visible and contrast is 4.5:1 or more;
   - `prefers-reduced-motion` is respected;
   - `verify-flow` passes for its flows, with screenshots in the pull request.

## Known Gaps

- No dark mode tokens.
- Hover and pressed states are not defined yet. Until they are, darken `{colors.primary}` by 8% on hover.
- The sport icons are drawn only in `docs/design/mockup.html`. Move them into `packages/shared/icons` in the web plan, step 1.
