# Project Agent Guidance

## Hero Section & Landing Page Standards

- **Above-the-Fold Discipline:** The entire hero (headline, subheadline, CTAs, featured product showcase, selector controls, and trust strip) must fit cleanly within a `1440x900` desktop viewport without vertical overflow.
- **Visual Hierarchy:** Use strictly three text levels (promo/eyebrow badge, `<h1>` display headline, concise subheadline), one high-contrast primary CTA, and one lower-weight secondary CTA.
- **Dark-Mode Product Framing:** Never display raw white-background product JPEGs directly on dark cards without treatment. Use transparent PNGs, radial spotlight backdrops, or clean framed containers with rounded corners and a subtle border or glow.
- **Interactive Carousels:** Auto-cycling hero showcases must use clean `useEffect` timers with synced CSS/state progress indicators, pause on hover and keyboard focus, click-to-select tabs, previous/next controls, and proper timer cleanup on unmount.
- **Core Web Vitals (LCP):** Eager-load (`loading="eager"` / `priority`) the active hero product image and reserve its dimensions to prevent layout shifts (CLS) when switching slides.
