# Flow mobile-account

Mobile "Tôi" tab: guest buttons, the register sheet, the profile, and logout (UC-1, brief F-027, AC-1, AC-2, AC-6, AC-8, AC-10). Script: `scripts/mobile-account.mjs`. Screen: `/app/toi`.

The flow never submits the register form, because a sign-up on `live` creates a real account (BR-29). It logs in once as the player (`setup` step) and reuses that cookie at both sizes. Logout only clears the cookie, so the next flow keeps its session. On `live`, the screenshot masks the user name (`[data-testid="user-name"]`), `input[type="tel"]`, and the text of the dialog (see `lib.mjs`).

| Step | Asserts |
|---|---|
| log in as player | Signed in as the player account (`role USER`) |
| guest opens Tôi (390x812) | The buttons "Đăng nhập" and "Tạo tài khoản" are visible |
| guest opens the register sheet (390x812) | The sheet has "Tên", "Số điện thoại", "Mật khẩu", the 5 paragraphs of the privacy notice, and the consent box unticked. `scrollWidth <= innerWidth`. Every button in the sheet, except "Đóng", is at least 44px high |
| guest closes the register sheet (390x812) | The sheet closes and the guest buttons stay |
| player opens Tôi (390x812) | The name, the label "Người chơi", and "Đăng xuất" show. "Đăng nhập" does not |
| player logs out (390x812) | `POST /api/auth/logout` answers 2xx. "Đăng nhập" and "Tạo tài khoản" come back |
| the same five steps at 360x800 | AC-10 at 360px |

## When it fails

- Sideways scroll or a target under 44px: the message names the element and its height. Fix the sheet or `RegisterSheet.tsx`.
- Fewer than 5 paragraphs: `PRIVACY_NOTICE` in `packages/shared/src/account.ts` changed. Update `NOTICE_STARTS` in the script.
- Name not found: the account has no name, or `ToiScreen.tsx` changed its profile block.
