# GitHub Action Points

Use this document to create issues or project cards directly on GitHub.

## Major

- ~~Confirm POS invoice printing and ensure the thermal receipt and A4 invoice buttons appear in the charge flow.~~
- ~~Finish responsive UI fixes for mobile and tablet across the storefront, POS screen, owner dashboard, admin dashboard, and header/navigation.~~
- Verify owner branch visibility and admin branch/subscription management:
  - owner can see all assigned branches
  - admin can manage branches and subscription limits
- Ensure storefront layout controls remain admin-only in the owner panel.
- Re-upload previously lost product images (wiped by Render ephemeral filesystem before Cloudinary was configured).

## Medium

- Add owner-friendly messaging on the storefront page for non-admin users.
- Validate the custom storefront layout is fully registered and selectable in the admin storefront selector.
- ~~Review README for missing deployment or setup details after recent changes.~~
- Add a short note about the current layout system and admin-only control to the documentation if needed.
- Regenerate Cloudinary API secret (was shared publicly) and update the env var in Render.

## Low / Future

- Plan runtime layout import support as a later enhancement.
- Add tests or QA checks for layout switching, branch visibility, and subscription requests.
- Add GitHub issues or a project board for follow-up work.
