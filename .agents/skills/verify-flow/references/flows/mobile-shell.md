# Flow mobile-shell

Mobile app shell (brief F-019). Script: `scripts/mobile-shell.mjs`. Screens: mobile shell (`/app/`).

| Step | Asserts |
|---|---|
| open 390x812: no sideways scroll, tab bar visible | `document.documentElement.scrollWidth <= innerWidth` (no sideways scroll). The tab bar (`navigation` named 'Điều hướng') is visible with `translateY(0)` |
| scroll down 300px (390x812): tab bar hidden | The tab bar is hidden (`transform` contains `calc(100% + 24px)`) |
| scroll up 50px (390x812): tab bar shows again | The tab bar is visible again (`transform` contains `translateY(0)`) |
| open 360x800: no sideways scroll, tab bar visible | `document.documentElement.scrollWidth <= innerWidth` (no sideways scroll). The tab bar is visible with `translateY(0)` |
| scroll down 300px (360x800): tab bar hidden | The tab bar is hidden (`transform` contains `calc(100% + 24px)`) |
| scroll up 50px (360x800): tab bar shows again | The tab bar is visible again (`transform` contains `translateY(0)`) |

## When it fails

- Sideways scroll: an element in the mobile shell exceeds the screen width.
- Tab bar does not hide on scroll down: check `useHideOnScroll` hook and `TabBar` transform.
- Tab bar does not restore on scroll up: check scroll threshold (8px) in `useHideOnScroll`.
