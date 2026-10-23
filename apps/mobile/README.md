# apps/mobile

The phone app of MONSPORT: a PWA served at `/app/`, separate from `apps/web`. Status: shell built (brief F-019), tabs come in later briefs.

- Decision: `docs/adr/0006-app-mobile-pwa.md` (Accepted).
- Plan and build order: `docs/design/ke-hoach-app-mobile.md`.
- Design standard: `DESIGN.md`, section "Mobile app shell".

Rules:

- Import shared code from `packages/shared` and `packages/client` only. Never import from `apps/web`.
- Follow the scroll table in `DESIGN.md`: the top bar and the tab bar hide on scroll down and come back on scroll up.
