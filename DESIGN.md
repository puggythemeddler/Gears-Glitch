---
name: Gear&Glitch
description: Multi-tenant electronics retail and repair platform — POS, inventory, repairs, and tax-compliant invoicing (KRA eTIMS submission planned, not yet enabled)
colors:
  till-orange: "#c2410c"
  till-orange-deep: "#9a3412"
  till-orange-light: "#ffedd5"
  warm-paper: "#fafaf9"
  warm-paper-surface: "#ffffff"
  warm-paper-hover: "#f5f5f4"
  ink: "#1c1917"
  ink-secondary: "#57534e"
  ink-tertiary: "#716d68"
  hairline: "#e7e5e4"
  hairline-hover: "#d6d3d1"
  success: "#16a34a"
  success-light: "#dcfce7"
  success-text: "#065f46"
  warning: "#a16207"
  warning-light: "#fef9c3"
  warning-text: "#854d0e"
  danger: "#dc2626"
  danger-light: "#fee2e2"
  danger-text: "#991b1b"
  info: "#2563eb"
  info-light: "#dbeafe"
  workbench-amber: "#f59e0b"
  muted: "#716d68"
typography:
  display:
    fontFamily: "Archivo, Sora, system-ui, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Archivo, Sora, system-ui, sans-serif"
    fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Sora, system-ui, -apple-system, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Sora, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
  4xl: "40px"
  5xl: "48px"
  6xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.till-orange}"
    textColor: "{colors.warm-paper-surface}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.till-orange-deep}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.25rem"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.md}"
    padding: "0.5rem 1.25rem"
  input:
    backgroundColor: "{colors.warm-paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.5rem 0.75rem"
  card:
    backgroundColor: "{colors.warm-paper-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
---

# Design System: Gear&Glitch

## Overview

**Creative North Star: "The Workshop Bench"**

Gear&Glitch is the operating system for an electronics retail and repair business — and the visual world reflects that duality. The warm-black surfaces and orange tool accents evoke a well-organized workbench: functional, tactile, built for speed. The neutrals are warm stone, not cold gray, because a workshop is a warm place. The primary accent is Till Orange — the color of a tool handle, a safety signal, a sale-complete pulse — used sparingly so it never loses its force.

The system serves two modes: **Operate** (the POS till, the admin dashboard, the staff portal) and **Persuade** (the marketing site, the public storefront). Operate surfaces are dense, scannable, keyboard-first. Persuade surfaces are editorial, spacious, image-led. The same warm palette and tactile component language runs through both, so the brand reads as one product.

Dark mode is not a mechanical inversion of light — it is a composed warm-black world (`#0b0a09` backgrounds, `#161311` surfaces) with a brighter Till Orange (`#f97316`) that maintains contrast on dark. Both themes are designed explicitly, not flipped.

**Key Characteristics:**
- Warm neutrals (stone family, not slate) in both themes
- Till Orange as the single primary accent — rare, purposeful, never decorative
- Archivo display + Sora body — industrial grotesque paired with a humanist sans
- Tactile, confident components — hairline borders, solid fills, clear focus rings
- 4px-base spacing scale with deliberate tight/generous rhythm
- Semantic colors (success/warning/danger/info) kept consistent across themes

## Colors

The palette is a warm-neutral canvas with one purposeful orange accent. Semantic colors are functional, not decorative.

### Primary
- **Till Orange** (#c2410c light / #f97316 dark): the single brand accent. Used on primary buttons, active nav items, links, focus rings, and the sale-complete pulse. Its rarity gives it force — it never appears on more than ~10% of any screen.

**The One Voice Rule.** Till Orange is used on ≤10% of any given screen. If everything is orange, nothing is.

### Secondary
- **Workbench Amber** (#f59e0b): the secondary accent for repair cards, highlights, and identity-card repair icons. Warm and close to Till Orange in hue, but distinct enough to signal "repair" vs "sale."

### Neutral
- **Warm Paper** (#fafaf9 light / #0b0a09 dark): the page canvas — a warm off-white in light, a warm near-black in dark.
- **Warm Paper Surface** (#ffffff light / #161311 dark): elevated cards, panels, and inputs sit one step above the canvas.
- **Warm Paper Hover** (#f5f5f4 light / #201c19 dark): the hover state for surfaces.
- **Ink** (#1c1917 light / #f4f1ec dark): primary text — warm near-black in light, warm off-white in dark.
- **Ink Secondary** (#57534e / #a8a29b): body text, descriptions, labels on surfaces.
- **Ink Tertiary** (#716d68 / #87817a): placeholders, muted text, tertiary labels. WCAG AA verified at 4.5:1 in both themes.
- **Hairline** (#e7e5e4 / #262019): borders, dividers, separators — the thinnest visual structure.
- **Hairline Hover** (#d6d3d1 / #3d3327): border hover state.

### Semantic
- **Success** (#16a34a / #22c55e): confirmations, paid states, low-stock-OK. Success text variant (#065f46 / #4ade80) for text on light backgrounds.
- **Warning** (#a16207 / #facc15): low-stock alerts, pending states. Warning text variant (#854d0e / #fde047).
- **Danger** (#dc2626 / #ef4444): errors, out-of-stock, delete actions, count badges. Danger text variant (#991b1b / #fca5a5).
- **Info** (#2563eb / #60a5fa): informational badges, info-status messages. Kept blue (semantic, not brand) to distinguish from Till Orange.

**The No-Gray Rule.** Neutral text is always warm-tinted (stone family), never generic gray. A workshop has warm light, not fluorescent.

## Typography

**Display Font:** Archivo (with Sora, system-ui fallback)
**Body Font:** Sora (with system-ui, -apple-system fallback)
**Label/Mono Font:** Sora for labels; JetBrains Mono for code/data

**Character:** Archivo is an industrial grotesque — sturdy, practical, slightly mechanical. Paired with Sora, a humanist sans with warmth. The pairing says "precision workshop": structured but not cold.

### Hierarchy
- **Display** (700, clamp(2rem, 4vw, 3.25rem), 1.12, -0.02em): hero headlines, marketing page titles. Archivo.
- **Headline** (700, clamp(1.6rem, 2.6vw, 2.2rem), 1.2, -0.02em): section titles, page H1s in Operate surfaces. Archivo.
- **Title** (600, 1.0625rem, 1.25): card titles, panel headers, feature names. Sora.
- **Body** (400, 0.9375rem, 1.5): paragraphs, descriptions, table cells. Sora. Max line length 65–75ch on Read surfaces.
- **Label** (500, 0.8125rem, 1.4): nav items, badges, table headers (uppercase + 0.05em tracking). Sora.

**The Money Rule.** Monetary values use `font-variant-numeric: tabular-nums` so digits don't jitter as values change. Applies to POS totals, cart line totals, and all data-table numeric columns.

## Layout

The system uses a 4px-base spacing scale (--space-1 = 4px through --space-16 = 64px). Tight groups use 4–8px; generous separations use 24–48px. The rhythm is deliberate: tight within groups, generous between groups.

**Grid:** max-width 1200px for marketing; full-bleed for Operate surfaces (POS, admin). The admin sidebar is a full-viewport rail (232px, sticky, 100vh) on headerless pages; a card-offset nav on pages with the site header.

**Breakpoints:** 1024px (tablet — hero stacks, nav collapses), 768px (mobile — grids to 1-2 columns, sidebar becomes a 45vh scrollable card), 520px (small mobile — feature grids to 1 column, stats to 2 columns).

**Density:** Operate surfaces are dense (small type, tight spacing, high information per region). Persuade surfaces are spacious (large type, generous padding, one idea per section).

## Elevation & Depth

The system uses **tonal layering**, not heavy shadows. Surfaces elevate by stepping one tone lighter/darker than the canvas. Shadows are subtle and structural, never decorative.

### Shadow Vocabulary
- **Shadow SM** (`0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`): rest state for cards that need a hint of depth.
- **Shadow LG** (`0 10px 15px rgba(0,0,0,0.06), 0 4px 6px rgba(0,0,0,0.04)`): hover lift on product cards, stat cards.
- **Shadow XL** (`0 20px 25px rgba(0,0,0,0.08), 0 8px 10px rgba(0,0,0,0.04)`): dashboard preview frames, modals.

**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, elevation, focus). No shadow on a resting card.

## Shapes

Corner strategy is gently rounded — not pill-soft, not sharp. Borders are 1px hairlines, not thick frames.

- **SM** (6px): small controls, badges, chips.
- **MD** (8px): buttons, inputs, search fields.
- **LG** (12px): cards, panels, stat cards.
- **XL** (16px): modals, large containers.
- **Full** (9999px): pills, count badges, avatar circles.

Inputs use a 3px focus ring (`box-shadow: 0 0 0 3px var(--primary-subtle)`) — the Till Orange glow that confirms attention without shouting.

## Components

### Buttons
- **Shape:** gently rounded (8px radius).
- **Primary:** Till Orange fill, surface-color text. Padding 0.5rem 1.25rem. Dark theme: black text on orange for ~8:1 contrast.
- **Hover/Focus:** deepens to Till Orange Deep; 3px focus ring in primary-subtle.
- **Secondary:** transparent fill, Ink text, Hairline Hover border. Hover: surface-hover background.
- **Ghost:** transparent, Ink Secondary text, no border. Hover: surface-hover background, Ink text.
- **Danger:** Danger fill, white text. Hover: #b91c1c.
- **Subtle:** primary-subtle background, Till Orange text. Hover: primary-light.

**The Tactile Rule.** Buttons feel confident — solid fills on primary, hairline borders on secondary, clear focus rings on all. No ghost borders that vanish on dark themes.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** Warm Paper Surface (one tone above canvas).
- **Shadow Strategy:** flat at rest; Shadow LG on hover lift.
- **Border:** 1px Hairline.
- **Internal Padding:** 16–20px.

### Inputs / Fields
- **Style:** 1px Hairline border, Warm Paper Surface background, 8px radius.
- **Focus:** border shifts to Till Orange + 3px primary-subtle ring.
- **Error:** border shifts to Danger, error text below in Danger color.
- **Disabled:** 0.5 opacity, not-allowed cursor.

### Navigation
- **Sidebar rail (admin):** full-viewport, sticky, 232px, card with filter search. Group labels are uppercase 0.68rem. Active items: primary-subtle background + Till Orange text + semibold. aria-current on active.
- **Category bar (POS):** 160px rail, flat buttons. Active: Till Orange fill, surface text. aria-pressed on active.
- **Top nav (storefront):** sticky header, springboard category dropdown, search, cart badge.

### Chips / Badges
- **Filter chips:** pill (full radius), Hairline border, Ink Secondary text. Active: Till Orange fill, surface text.
- **Count badges:** full radius, Danger fill, white text (cart, notification counts).
- **Status pills:** semantic light background + semantic text color (success/warning/danger/info).

### Stat Cards
- **Shape:** 12px radius, 1px Hairline border, Warm Paper Surface.
- **Value:** Archivo, 1.875rem, 700, Till Orange. `tabular-nums`.
- **Label:** Sora, 0.8125rem, 500, Ink Secondary.
- **Hover:** translateY(-2px), Shadow LG, Till Orange border.

## Do's and Don'ts

### Do:
- **Do** use Till Orange on ≤10% of any screen — its rarity is its force.
- **Do** use warm stone neutrals, never generic gray, in both themes.
- **Do** use `tabular-nums` on all monetary values so digits don't jitter.
- **Do** keep touch targets ≥32px on Operate surfaces, ≥44px on customer-facing surfaces.
- **Do** pair Archivo for display/headlines with Sora for body — never swap them.
- **Do** design dark mode as a composed warm-black world, not a mechanical inversion.

### Don't:
- **Don't** use Till Orange for decoration — it's the primary action color, not a background tint.
- **Don't** use slate or cool-gray neutrals — the workshop is warm.
- **Don't** add shadows to resting cards — depth is a response to state.
- **Don't** use emoji as icons — draw SVGs with one stroke and one weight.
- **Don't** animate every section entrance — one authored moment per page, reduced-motion safe.
- **Don't** use Sora for display headlines — that's Archivo's role; Sora is the body voice.
