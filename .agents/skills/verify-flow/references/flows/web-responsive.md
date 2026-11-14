# Flow web-responsive

Responsive layout check for brief F-033 (`docs/briefs/F-033-giao-dien-web-moi.md`, `docs/design/web-responsive.md`). Script: `scripts/web-responsive.mjs`.

| Step | Asserts |
|---|---|
| `/dang-nhap` at 390/768/1024/1440px | Guest context visits `/dang-nhap`. At 390px, 768px, 1024px, and 1440px, `document.documentElement.scrollWidth <= window.innerWidth` and no visible element outside `overflow-x: auto|scroll` containers extends past `window.innerWidth` |
| Player routes (`/`, `/phong-cho`, `/san`, `/san/:id`, `/doi`, `/lich-cua-toi`, `/ho-so`) at 390/768/1024/1440px | Signed-in player visits each route; no horizontal overflow at any of the 4 widths |
| Owner routes (`/chu-san/tong-quan`, `/chu-san/yeu-cau`, `/chu-san/lich`, `/chu-san/doanh-thu`, `/chu-san/don-vi`) at 390/768/1024/1440px | Signed-in owner visits each route; no horizontal overflow at any of the 4 widths |
| Admin routes (`/admin`, `/admin/tai-khoan`, `/admin/bao-cao`, `/admin/mon`) at 390/768/1024/1440px | Signed-in admin visits each route; no horizontal overflow at any of the 4 widths. On `live`, ends with `SKIP` if `VERIFY_ADMIN_PHONE` and `VERIFY_ADMIN_PASSWORD` are unset |

## When it fails

- Sideways scroll or right-edge overflow on a specific route/width: check `apps/web/src/app/styles.css` media queries (`1319px`, `979px`, `719px`, `419px`) and wrap wide tables in `.table-scroll` (with sticky col 1 on `.stats-table` and stacked card mode on `.tbl:not(.stats-table)` under `720px`).
- Login step fails with 429: BR-30 throttled auth requests from this IP. Wait 15 minutes (see [references/gotchas.md](../gotchas.md)).
