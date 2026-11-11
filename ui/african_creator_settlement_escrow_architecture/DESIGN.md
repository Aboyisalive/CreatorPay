---
name: African Creator Settlement & Escrow Architecture
colors:
  surface: '#faf9f5'
  surface-dim: '#dbdad6'
  surface-bright: '#faf9f5'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f0'
  surface-container: '#efeeea'
  surface-container-high: '#e9e8e4'
  surface-container-highest: '#e3e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#4f4632'
  inverse-surface: '#2f312e'
  inverse-on-surface: '#f2f1ed'
  outline: '#817660'
  outline-variant: '#d3c5ac'
  surface-tint: '#775a00'
  primary: '#775a00'
  on-primary: '#ffffff'
  primary-container: '#ffc61a'
  on-primary-container: '#6e5400'
  inverse-primary: '#f6be0a'
  secondary: '#825500'
  on-secondary: '#ffffff'
  secondary-container: '#fdbe63'
  on-secondary-container: '#754c00'
  tertiary: '#674bb4'
  on-tertiary: '#ffffff'
  tertiary-container: '#d5c6ff'
  on-tertiary-container: '#6044ad'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdf98'
  primary-fixed-dim: '#f6be0a'
  on-primary-fixed: '#251a00'
  on-primary-fixed-variant: '#5a4300'
  secondary-fixed: '#ffddb4'
  secondary-fixed-dim: '#fabb61'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#633f00'
  tertiary-fixed: '#e8ddff'
  tertiary-fixed-dim: '#cebdff'
  on-tertiary-fixed: '#21005e'
  on-tertiary-fixed-variant: '#4f319b'
  background: '#faf9f5'
  on-background: '#1b1c1a'
  surface-variant: '#e3e2df'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-numeric-lg:
    fontFamily: JetBrains Mono
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.02em
  label-numeric-md:
    fontFamily: JetBrains Mono
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0em
  label-numeric-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-badge:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.25rem
  gutter-mobile: 0.75rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style
This design system bridges rigorous institutional commercial banking infrastructure (via Ecobank) with the cultural kinetic energy of the modern African creator economy. The visual atmosphere rejects cold, generic Silicon Valley neobanking tropes in favor of an authoritative, high-contrast, editorial fintech aesthetic. 

The emotional signature is **uncompromising financial clarity paired with optimistic momentum**: creators experience radical transparency over contractual deliverables, automated escrow verifications, and cross-border disbursements, while enterprise brands and agency CFOs encounter audit-grade controls. The style blends **Modern Editorial Utility** and **Tactile Ledger Precision**: warm chalk-sand backgrounds, architectural hairline borders, razor-sharp status indicators, and prominent monospaced tabular figures that elevate the Nigerian Naira (₦), Kenyan Shilling (KSh), and Pan-African corridors to institutional instruments.

## Colors
The palette balances an electric brand gold with strict institutional semantic governance:

- **Core Canvas & Chrome:**
  - Canvas Root: `#FAF9F5` (Warm sand-tinted chalk)
  - Card & Container Surface: `#FFFFFF`
  - Boundary Hairlines: `#E4E1D8`
  - Primary Text (Ink-1): `#17150F` (98% contrast deep charcoal)
  - Secondary / Supporting Text (Ink-2): `#4A463D`
  - Brand Anchor: Primary Yellow `#FFC61A` paired with Deep Amber `#8A5A00` for WCAG AA accessible contrast on interactive labels and focus states.

- **The 4 Levels of Ledger Truth & Semantic Hierarchy:**
  - **Level 1 (Institutional Settlement / Bank-Confirmed):** Solid Paid Green (`#146C38` text/solid, `#E6F4EA` surface tint). Strictly reserved for irreversible Ecobank core settlements and executed payouts. Never used for pending or soft deliverables.
  - **Level 2 (In Escrow / Manual Settlement Required):** Institutional Violet (`#5B3FA8` text/solid, `#EFEAFB` surface tint). Denotes approved deliverables, release-ready funds, or pending maker-checker actions.
  - **Level 3 (Action Required / Milestone Drift):** Burnt Orange (`#9C4A00` text/solid, `#FFEEDB` surface tint). Flags unverified campaign content, deliverable mismatches, or escrow auto-release countdowns.
  - **Level 4 (Audit Exception / Reversal / Breach):** Structural Crimson (`#B42318` text/solid, `#FDECEA` surface tint). Indicates contract dispute, KYC hold, or reversed clearing batch.
  - **Ledger Telemetry (Informational):** Banking Blue (`#1F5FBF` text/solid, `#E7EFFC` surface tint). Denotes clearing networks, intermediary fx rates, and API polling metadata.

## Typography
Typography enforces structural rigor and eliminates ambiguous monetary interpretation:

- **Primary Interface (Inter):** Utilized for structural titles, form labels, narrative copy, and workflow controls. Tuned with optical negative kerning at high scales to present a compact, confident posture.
- **Ledger Figures & Currency Units (JetBrains Mono):** Mandatory for all escrow balance metrics, account numbers, routing indices, batch sequence identifiers, currency codes (NGN, GHS, KES, USD), and timestamps. Tabular lining ensures multi-currency data columns align perfectly along vertical axes without visual wobble.
- **Scale Rules:** Display and headline levels shift down exactly one grade on mobile devices to preserve horizontal line efficiency inside dense escrow ledger cards.

## Elevation & Depth
In alignment with strict institutional accounting and tactile modern fintech, visual depth relies primarily on **Tonal Layers and Structural Hairlines** rather than synthetic floating drop-shadows:

- **Surface Levels:**
  - `Level 0 (Base Canvas)`: Deep sand tone `#FAF9F5`. No shadows.
  - `Level 1 (Card & Module Surfaces)`: Solid White `#FFFFFF` edged with `#E4E1D8` 1px border.
  - `Level 2 (Active Escrow / Focused Cells)`: `#FFFFFF` elevated with a razor-thin tinted ambient shadow: `0px 2px 6px rgba(23, 21, 15, 0.04), 0px 8px 24px rgba(74, 70, 61, 0.06)`, framed by a 1px border.
  - `Level 3 (Modal Ledger & Ecobank Direct Authorization)`: Elevated backdrop scrim with `rgba(23, 21, 15, 0.4)` and a crisp card container framed by `#17150F` at 1.5px stroke weight.

## Shapes
A controlled **Soft (0.25rem / 4px base)** shape language is enforced to maintain commercial banking precision:

- Standard inputs, buttons, audit table rows, and status badges take a `4px` corner radius.
- Cards, ledger surfaces, and dashboard metric pods utilize `rounded-lg` (`8px`).
- Floating drawers, campaign preview modals, and slide-overs utilize `rounded-xl` (`12px`).
- Fully rounded / pill shapes are strictly prohibited except for micro status badge indicators (100px radius) to differentiate them from actionable click surfaces.

## Components

- **Buttons & Settlement Triggers:**
  - *Primary (Brand Payout / Escrow Fund):* `#FFC61A` fill, `#17150F` bold text, `#8A5A00` subtle border inset on active state. Hover shifts to a deep golden burnish `#F5BC10`.
  - *Institutional Action (Release to Bank):* Solid `#146C38` background with `#FFFFFF` text. Used exclusively when funds are leaving escrow into an Ecobank settlement route.
  - *Secondary / Utility:* `#FFFFFF` background, `#E4E1D8` border, `#17150F` text with `#FAF9F5` hover tint.
  - *Destructive / Reject Milestone:* `#FDECEA` tint with `#B42318` text and border.

- **Truth Badges (Status Chips):**
  - Height: 24px. Monospaced font (`label-badge`), uppercase with `0.06em` letter spacing.
  - *Paid (Bank Confirmed):* Background `#E6F4EA`, Text & Icon `#146C38`, Left 4px status tick.
  - *Escrowed / Payable:* Background `#EFEAFB`, Text `#5B3FA8`.
  - *Deliverable Review:* Background `#FFEEDB`, Text `#9C4A00`.
  - *Disputed / Audit Flag:* Background `#FDECEA`, Text `#B42318`.

- **Audit Ledger & Milestone Rows:**
  - Table rows have an explicit 1px divider (`#E4E1D8`). Hover state evokes `#FAF9F5`.
  - Monetary values are right-aligned, rendered exclusively in `JetBrains Mono` (`label-numeric-md`), alongside a small currency badge (e.g., `NGN`, `KES`).

- **Input Fields & Currency Inputs:**
  - Container background `#FFFFFF`, border 1px solid `#E4E1D8`, text `#17150F`.
  - Focus state swaps border to `#17150F` with an external 2px ring in `#FFC61A`.
  - Currency inputs feature an anchored, non-editable currency prefix block in `#FAF9F5` with `JetBrains Mono` labeling.

- **Specialized Escrow Milestone Cards:**
  - Dual-state cards with deliverable proofs (e.g., live link tracking, asset hash verification).
  - Include an embedded countdown badge for the Ecobank 48-Hour Auto-Settlement window before payout unlocks.