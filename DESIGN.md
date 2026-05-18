# Wave One Dashboard — Design System

> Inferred from the live application as of 2026-05-17 and reconciled with `tailwind.config.ts` tokens.
> Source of truth for design decisions. Deviations from this document are higher-severity in `/design-review` audits.

## 1. Voice

Wave One is a **finance ops tool for a coaching business**. The UI should feel:

- **Competent over playful.** Money is on the line. Confidence beats personality.
- **Dense over airy.** Operators scan tables; they aren't here for a hero shot.
- **Specific over generic.** Real labels, real numbers, real microcopy. No "Welcome to your dashboard."
- **Calm over loud.** One accent color does one job at a time. Two accents fighting is noise.

## 2. Color System

All color tokens live in `tailwind.config.ts` under `theme.extend.colors`. Use tokens, never hex literals in components.

### Brand
| Token | Hex | Use |
|---|---|---|
| `primary` | `#0B1220` | Sidebar background, primary text, primary buttons |
| `on-primary` | `#FFFFFF` | Text on primary surfaces |
| `accent` | `#FF5E3A` | Reserved for **large + bold** elements only (buttons ≥14pt bold). Coral spark. |
| `accent-text` | `#D14416` | **NEW.** Coral variant for small text (links, eyebrows, labels). Passes WCAG AA on white. |
| `accent-soft` | `#FFE6DD` | Coral-tinted backgrounds |

**Contrast rule:** `accent` (`#FF5E3A`) on white is 3.02:1 — fails WCAG AA for body text. Use `accent-text` (`#D14416`, 4.5:1) for any coral text under 18px / 14pt-bold. Reserve `accent` for button backgrounds, large headlines, and decorative use.

### Semantic
| Token | Hex | Use |
|---|---|---|
| `secondary` (success) | `#059669` | Positive deltas, "Pagado", success badges |
| `tertiary` (warning) | `#D97706` | "Pendiente", "Vencido", attention-required |
| `error` | `#DC2626` | Destructive actions, error states |
| `info` | `#2563EB` | Informational badges, Stripe brand |

Each semantic color has a `-container` (tinted background) and `on-*-container` (text on container) pair.

### Surface
| Token | Hex | Role |
|---|---|---|
| `background` | `#F9F9F6` | Page background (warm cream) |
| `surface-container-lowest` | `#FFFFFF` | Cards, modals |
| `surface-container-low` | `#F4F4F0` | Subtle elevation |
| `surface-container` | `#EFEFEA` | Form fields, table header rows |
| `surface-container-high` | `#E9E9E2` | Hover states |

**Never use pure black or pure white outside of cards.** Background is always warm cream `#F9F9F6`.

## 3. Typography

Three typefaces. No system-ui as primary.

| Family | Token | Role |
|---|---|---|
| Plus Jakarta Sans | `font-headline` | Display + headlines (H1, H2, brand wordmark) |
| Inter | `font-body` | Body text, labels, UI chrome |
| JetBrains Mono | `font-mono` | Tabular numbers, dates, transaction IDs, code |

### Scale (all in `tailwind.config.ts`)

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| `display-lg` | 48/56 | 700 | Marketing hero (login splash if used) |
| `display-md` | 38/46 | 700 | Page-level $ amounts on hero KPI cards |
| `headline-lg` | 30/38 | 700 | Page title (H2) |
| `headline-md` | 22/30 | 600 | Section title |
| `headline-sm` | 17/24 | 600 | Subsection (H3) |
| `title-md` | 15/22 | 600 | Card title |
| `label-caps` | 11/14 | 700, 0.08em tracking | Eyebrows, KPI labels |
| `body-lg` | 16/24 | 400 | Body text, descriptions |
| `body-md` | 14/20 | 400 | Secondary text, table cells |
| `body-sm` | 13/18 | 400 | Helper text, captions |
| `data-mono` | 13.5/20 | 500 | Mono numeric in tables |

### Rules
- H1 is reserved for `<header>` of the page (e.g., sidebar wordmark). H2 = page title.
- Eyebrows (`label-caps`) are always **uppercase, gray (`text-on-surface-variant`), 11px**. Never coral. Never `WAVE ONE — X` format.
- Money values use `font-mono` with `tabular-nums`.
- Dates use `font-mono` for table alignment.
- No letterspacing on lowercase body text.

## 4. Spacing

8px base scale. Use tokens:

| Token | Value |
|---|---|
| `xs` | 4px |
| `base` | 8px |
| `sm` | 12px |
| `md` | 20px |
| `gutter` | 24px |
| `lg` | 48px |

Card padding default: `p-6` (24px). Section gap default: `gap-6` (24px). Page horizontal padding: `px-6 md:px-8`.

## 5. Components

### KPI Cards (strips)

**Rule of symmetry:** Every card in a KPI strip MUST share the same visual structure. Either ALL cards have a semantic tint background, or NONE do. Either ALL cards have a comparison delta, or NONE do.

Variants:
- **Plain** (`surface-container-lowest`): Default. Use when no semantic state applies.
- **Tinted** (`bg-*-container`): Use when the KPI ITSELF carries semantic meaning (debt = rose, success = mint, warning = amber, neutral total = surface-container).
- **Hero** (`primary` bg with white text): Reserved for ONE card per strip when there's a "headline" metric (e.g., `SALDO LÍQUIDO`, `DEUDA TOTAL`).

Comparison delta: optional, but ALL OR NONE within a strip.

### CTAs

Two button-color rules:

- **Primary action** (additive: "Añadir corredor", "Nuevo gasto", "Exportar"): `bg-primary text-on-primary` (black).
- **Side-effect action** (touches external system or flags warning: "Sincronizar", "Enviar Gasto"): `bg-accent text-on-accent` (coral).

Coral CTA is the exception, not the rule. If unsure, use black.

### Eyebrows

Always `text-label-caps text-on-surface-variant uppercase`. Single word or two words separated by spaces. **Never** `WAVE ONE — <SECTION>` format. **Never** coral.

### Tables

- Container: `bg-surface-container-lowest rounded-2xl shadow-soft overflow-hidden`.
- Header row: `bg-surface-container text-on-surface-variant text-label-caps`.
- Mono columns (dates, amounts): `font-mono`.
- Money columns: `min-width: 110px`, right-aligned, `text-error` for negative, `text-secondary` for positive.
- Description columns: `truncate max-width: 280px` with title attribute for full text.
- Mobile horizontal-scroll tables: first column (label / name) must be `sticky left-0 bg-surface-container-lowest`.

### Avatars

Circle with initials. Background = stable hash of name → muted palette (gray, rose, amber, mint, violet at low saturation). NEVER coral (reserved for accent).

### Charts (recharts)

Constrained palette only. Use:
- Single-series: `accent` for primary, `outline` for grid.
- Categorical (2-6 series): brand pairs — `[primary, accent, secondary, tertiary, info, outline]`.
- Empty state: full overlay with "Sin datos" message, NEVER axis labels visible without data.

## 6. Motion

- Easing: `out-quint` (`cubic-bezier(0.22, 1, 0.36, 1)`) for entering. Default for exiting.
- Duration: 150–250ms for UI state, 300–400ms for entrance.
- Respect `prefers-reduced-motion: reduce`.
- Only animate `transform` and `opacity`. Never `width`, `height`, `top`, `left`.

## 7. Accessibility

- All interactive elements ≥44×44px on mobile (use padding to expand hit area).
- Visible focus ring: `focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2`.
- Color is never the only signal. Always pair with icon, text, or shape.
- Body text contrast ≥4.5:1 on its background.
- Large bold text (≥18px or ≥14px bold) contrast ≥3:1.

## 8. What to Avoid (AI Slop blacklist)

The following patterns are banned in this product:

1. Purple/violet/indigo gradients
2. 3-icon-circle feature grid as section decoration
3. Centered headings + body + cards stacked
4. Uniform bubbly border-radius on everything
5. Decorative blobs, floating circles, wavy SVG dividers
6. Emoji as design elements
7. Colored left-border on cards
8. Generic hero copy ("Welcome to...", "Unlock the power of...")
9. system-ui as the primary display/body font
10. Mixed-source chart libraries with rainbow default palettes
11. Decorative gradients on isolated cards (one card with a gradient while siblings are plain)

## 9. References

- Baseline audit: `.gstack/design-reports/design-audit-waveone-2026-05-17.md` (Design B+, AI Slop A)
- Token source: `tailwind.config.ts`
- Global CSS: `styles/globals.css`
