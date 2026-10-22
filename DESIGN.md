# MONSPORT design standard

Every screen in `apps/web` and `apps/mobile` follows this file. Read it before you write or review UI code. `AGENTS.md` holds the workflow; this file holds the look, the layout, and the behavior of screens.

Plans and mockups: `docs/design/`. Decision on the mobile app: `docs/adr/0006-app-mobile-pwa.md`.

## Two products, one system

| Product | Folder | Device | Role of the product |
|---|---|---|---|
| Web | `apps/web` | Desktop and laptop, 1024px and wider. Usable down to 768px | Owners at the counter, the admin, players who plan on a large screen |
| Mobile app | `apps/mobile` | Phone, 360px to 430px. Installed as a PWA | Players first, owners on the move |

Both products use the same tokens, icons, words, and API contract (`packages/shared`). They do not use the same layouts. Do not make one responsive layout that serves both.

## Principles

1. **One screen, one job.** A screen answers one question: "Which hour is free?", "Which requests wait for me?". Do not stack unrelated blocks on one page.
2. **Icon plus short word, never a sentence.** Show sport, status, and price as a chip or a row, not as a paragraph.
3. **Content first, chrome second.** On the phone, the bars hide while the user reads, and come back when the user scrolls up.
4. **The next action is always in reach.** The primary button of a flow is fixed at the bottom of the phone, or in the right pane of the desktop.
5. **Same word, same thing.** Use the terms of the table "Tên gọi" in the intake. A button and its result use the same verb: "Gửi yêu cầu" makes "Đã gửi yêu cầu".

## Tokens

Define tokens as CSS custom properties in one file per product: `src/app/tokens.css`. Do not write a raw hex value, a raw font size, or a raw shadow in a component.

### Color

| Token | Value | Use |
|---|---|---|
| `--c-court` | `#0F7B53` | Brand, primary button, active tab, selected slot |
| `--c-court-ink` | `#FFFFFF` | Text on `--c-court` |
| `--c-ink` | `#16201B` | Main text |
| `--c-ink-2` | `#5B6660` | Secondary text, icons at rest |
| `--c-canvas` | `#EEF1EF` | Page background behind cards (feed gray) |
| `--c-surface` | `#FFFFFF` | Cards, bars, sheets |
| `--c-line` | `#DCE2DE` | Dividers, input borders |
| `--c-peak` | `#C98A00` | Peak hours (17:00–22:00) marker only |

Status colors. Each status has a text color and a tint. Use them only for booking and match status, never for buttons.

| Status | Text | Tint | Icon |
|---|---|---|---|
| Chờ xác nhận | `#A15C00` | `#FFF3E0` | clock |
| Đã xác nhận | `#0F7B53` | `#E3F4EC` | check |
| Bị từ chối | `#B42318` | `#FDECEA` | x |
| Hết hạn, Đã hủy | `#5B6660` | `#EEF1EF` | minus |
| Trận Mở | `#0F7B53` | `#E3F4EC` | users |
| Trận Đầy | `#5B6660` | `#EEF1EF` | lock |

Errors use `#B42318`. The primary button is never red. Text contrast is 4.5:1 or more. Dark mode is not in scope for the first version.

### Type

- One family: **Be Vietnam Pro** (400, 600, 700), because it was drawn for Vietnamese diacritics. Do not add a second family.
- Numbers in prices, times, and counts use `font-variant-numeric: tabular-nums`.
- Sentence case everywhere. No all-caps labels.

| Token | Mobile | Web | Use |
|---|---|---|---|
| `--t-title` | 22/28 700 | 28/34 700 | Screen title |
| `--t-head` | 17/22 700 | 18/24 700 | Card or section title |
| `--t-body` | 15/21 400 | 15/22 400 | Text |
| `--t-meta` | 13/18 400 | 13/18 400 | Secondary line, time, address |
| `--t-chip` | 13/16 600 | 13/16 600 | Chips, tabs, badges |

### Space, radius, shadow

- Space scale: 4, 8, 12, 16, 24, 32 (`--s-1` to `--s-6`). Gaps between cards: 8 on mobile, 16 on web.
- Radius has a meaning: 8 for inputs and slots, 12 for cards, 999 for chips and the floating tab bar, 16 for the top of a sheet.
- Shadow only on things that float above content: the tab bar, a sheet, a menu. Cards have no shadow; they sit on `--c-canvas`.

## Icons

- Use one outline set: Lucide, 1.75px stroke, 20px in lists and 24px in bars. Import single icons; do not load a font.
- Sport icons are custom SVGs in `packages/shared/icons` (to create): `IconBadminton` (shuttlecock) and `IconFootball` (ball). Each sport has one icon and one short name: "Cầu lông", "Bóng đá".
- A sport is shown as a chip: icon plus short name. In a dense row (slot list, match card), show the icon alone with an `aria-label`.
- Status is always icon plus word. Never color alone.
- Do not use an emoji as an icon.

## Words and density

- A row holds one fact per line, and a card holds 3 lines at most. Move the rest to the detail screen.
- Price: "120k" in lists and chips, "120.000đ" in the summary and on the receipt.
- Time: "20:00–21:00". Date: "T7 24/10" in chips, "Thứ Bảy, 24/10/2026" in headers.
- Notices are one sentence. Move a longer explanation into a help sheet behind an info icon.
- An empty state says what to do next and has one button: "Chưa có booking. Đặt sân".

## Mobile app (`apps/mobile`)

### Shell

```
┌──────────────────────────────┐
│ MONSPORT        (+) (🔍) (🔔) │  top bar 52px, hides on scroll down
├──────────────────────────────┤
│ [T7 24/10] [CN 25/10] [...]  │  context bar (optional), sticks under the top bar
│                              │
│   content (feed or list)     │
│                              │
│ ┌──────────────────────────┐ │
│ │ Sân 1 · 20:00  [Gửi y/c] │ │  action bar (only during a flow)
│ └──────────────────────────┘ │
│  ( ⌂   ◷   ☰   🔔   ◉ )      │  floating tab bar 60px, hides on scroll down
└──────────────────────────────┘
```

### Scroll behavior (as in the Facebook app)

| Event | Top bar | Context bar | Tab bar | Action bar |
|---|---|---|---|---|
| Scroll down more than 8px | Slides up out of view | Moves up to `top: 0` and stays | Slides down out of view | Moves down to the bottom safe area and stays |
| Scroll up more than 8px | Slides back | Moves back under the top bar | Slides back | Moves back above the tab bar |
| At the top of the page (scrollY < 52) | Shown | Shown | Shown | Shown |
| At the end of the page | Unchanged | Unchanged | Shown | Shown |
| A sheet, menu, or keyboard is open | Frozen | Frozen | Hidden | Shown above the keyboard |

- Animate with `transform: translateY()` only, 200ms, `cubic-bezier(.2,.8,.2,1)`. Never animate `height` or `top`.
- Under `prefers-reduced-motion: reduce`, the bars do not slide; they stay shown.
- Implement the rule once, as the hook `useHideOnScroll` in `apps/mobile/src/hooks/`, with tests for each row of the table.
- Pad content with `env(safe-area-inset-*)`. The tab bar floats 12px above the bottom safe area, with a 999 radius and a white surface at 92% opacity with a backdrop blur.

### Navigation

| Role | Tabs (left to right) |
|---|---|
| Player and guest | Đặt sân · Phòng chờ · Lịch của tôi · Thông báo · Tôi |
| Owner | Yêu cầu (badge) · Lịch sân · Doanh thu · Thông báo · Tôi |
| Admin | Not on the mobile app. Show "Dùng web để quản trị" and a link |

- Each tab keeps its own scroll position and its own stack of screens.
- A detail screen opens on top of its tab with a back arrow, and hides the tab bar.
- Forms open as bottom sheets (booking a slot, phone booking, opening a match). A sheet has a grabber, a title, and one primary button at the bottom.
- Tap targets are 44px or more.

## Web (`apps/web`)

### Shell

| Role | Navigation | Content |
|---|---|---|
| Player and guest | Top bar with 3 links: Đặt sân, Phòng chờ, Lịch của tôi. Bell and account menu on the right | Content width 1280px at most, centered |
| Owner | Sidebar 220px: Yêu cầu (badge), Lịch sân, Doanh thu, Đơn vị và giá. Venue switcher at the bottom of the sidebar | Full width; the schedule grid needs it |
| Admin | Sidebar 220px: Tổng quan, Chủ sân, Đơn vị và sân | Tables with a right panel for create and edit |

- From 768px to 1023px, the sidebar becomes a 72px icon rail with tooltips.
- Under 768px, the web shows one banner: "Dùng app MONSPORT trên điện thoại" with a link to the mobile app. The web still works at that width, but no layout is designed for it.
- Each screen has its own URL. A notification links to the screen of its object, for example `/chu-san/yeu-cau/:id`.

### Layout patterns

- **List and detail** (Phòng chờ, Yêu cầu): list 40% on the left, detail on the right. A click does not leave the list.
- **Three panes** (Đặt sân): venues on the left (25%), the slot grid in the middle, the summary and the primary button on the right (25%). The summary does not scroll away.
- **Grid of courts by hours** (Đặt sân, Lịch sân): one row per court, one column per 30 minutes. It is the same component in both screens, with a read-only mode for players.
- **Table and panel** (admin): the panel opens on the right and the table stays visible.

## Components

Build each one once per product, in `src/components/`, before a feature needs a copy of it.

| Component | Rule |
|---|---|
| `Chip` | Icon plus short word. Selected chip uses `--c-court` |
| `StatusBadge` | Status icon plus word, with the status colors above |
| `SlotGrid` | Courts by 30-minute cells. Free cells are buttons. Peak cells have a `--c-peak` top border. Arrow keys move between cells |
| `ActionBar` | The fixed primary action of a flow, with the price on the left |
| `Sheet` (mobile) | Bottom sheet with a focus trap; closes on swipe down and on Escape |
| `Panel` (web) | Right panel with a focus trap; closes on Escape |
| `EmptyState` | One sentence and one button |
| `TabBar` (mobile), `Sidebar` and `TopNav` (web) | The navigation of the role, from the tables above |

## Done for a screen

- It follows the layout of its product and the scroll table above.
- It shows no raw hex value, no emoji icon, and no all-caps label.
- Checked at 390px for the mobile app, and at 1024px and 1440px for the web.
- Keyboard focus is visible, and contrast is 4.5:1 or more.
- `prefers-reduced-motion` is respected.
- `verify-flow` passes for the flows that touch the screen, with screenshots attached to the pull request.
