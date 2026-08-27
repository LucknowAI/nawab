---
name: Nawab AI
description: A Nawabi-heritage conversational copilot for everyday city life across Uttar Pradesh.
colors:
  gold: "#C8782E"
  gold-light: "#E09A50"
  ivory: "#FAF8F5"
  parchment: "#F0ECE4"
  ink: "#1C1525"
  ink-60: "#5C5070"
  rose: "#B05A4A"
  border: "#DED0B8"
  city-lucknow: "#C8782E"
  city-varanasi: "#D96020"
  city-kanpur: "#1A80C0"
  city-noida: "#8840CC"
  night: "#0A0710"
  night-bone: "#F8F2E8"
typography:
  display:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "clamp(2.2rem, 7vw, 4rem)"
    fontWeight: 300
    lineHeight: 1
    letterSpacing: "0.1em"
  headline:
    fontFamily: "Fredoka, sans-serif"
    fontSize: "1.1rem to 2rem"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.06em"
  title:
    fontFamily: "Google Sans, sans-serif"
    fontSize: "0.78rem to 1.05rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.03em"
  body:
    fontFamily: "Google Sans, sans-serif"
    fontSize: "0.82rem to 0.93rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "Google Sans, sans-serif"
    fontSize: "0.58rem to 0.72rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.1em"
rounded:
  sm: "8px"
  md: "10px"
  lg: "14px"
  xl: "16px"
  2xl: "20px"
  3xl: "22px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.md}"
    padding: "12px 32px"
  button-primary-hover:
    backgroundColor: "#2A1E3D"
    textColor: "{colors.ivory}"
    rounded: "{rounded.md}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "3px 11px"
  button-ghost-hover:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ivory}"
    rounded: "{rounded.pill}"
  city-badge:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "3px 12px 3px 8px"
  chat-input:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.3xl}"
    padding: "12px 14px 12px 20px"
  card-login:
    backgroundColor: "#FFFFFF"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "44px 40px 40px"
---

# Design System: Nawab AI

## 1. Overview

**Creative North Star: "The Gilded Diwan"**

Nawab AI dresses a conversational copilot in the vocabulary of a Nawabi royal court: an ivory-and-parchment audience hall, warmed by gold, presided over by deep aubergine ink. Every screen after login sits inside this "diwan": generous whitespace, ceremonial typography reserved for names and moments that matter, and a chat interface that behaves like a courteous attendant rather than a utility. The one deliberate departure is the city-selection screen, which drops into a near-black, hex-patterned "night court" (`#0A0710`) so that choosing a city reads as a threshold moment, not a settings toggle.

This system explicitly rejects the two easy defaults PRODUCT.md names: it is not a generic SaaS/AI chatbot (no flat dark mode as the base state, no purple gradients, no glassmorphism sprinkled everywhere, no robotic tech-bro chrome), and it is not a dry government portal (no bureaucratic gray-on-white forms, no cold institutional tone). Warmth and dignity carry the interface, not novelty.

**Key Characteristics:**
- Ivory-and-gold Nawabi palette as the constant; a single near-black "night" surface reserved for the city-selection ritual only.
- Fredoka appears only at emotional/ceremonial touchpoints; Google Sans carries every transactional surface.
- Four city identities (Lucknow gold, Varanasi ember, Kanpur river blue, Noida amethyst) recolor accents and glows without touching ink, border, or text tokens.
- Shadows are always soft, diffuse, and color-tinted; nothing sits heavy or stark at rest.
- Generous pill-and-rounded-corner vocabulary (8px–22px, up to full pill) signals tactile warmth, not playfulness.

## 2. Colors

The palette reads as warm parchment and burnished gold at rest, with a per-city accent that recolors glows and highlights without disturbing the ink/border/text foundation.

### Primary
- **Nawab Gold** (`#C8782E`): the default brand accent (Lucknow's city color). Drives primary CTAs, active tab state, focus rings, and hover fills on ghost buttons.
- **Gold Light** (`#E09A50`): lighter companion to Nawab Gold, used for hover text and secondary emphasis on dark surfaces.

### Secondary — City Identities
- **Lucknow Marigold** (`#C8782E`): default city, warm amber-gold.
- **Varanasi Ember** (`#D96020`): deeper burnt orange.
- **Kanpur River Blue** (`#1A80C0`): cool blue, the one non-warm city accent.
- **Noida Amethyst** (`#8840CC`): violet, the youngest/most modern city identity.

### Neutral
- **Warm Parchment Ivory** (`#FAF8F5`): page background; the default surface everywhere except the night-court overlay.
- **Parchment** (`#F0ECE4`): secondary surface — sidebar panel, badges, tag chips.
- **Deep Aubergine Ink** (`#1C1525`): primary text and foreground; also the fill for the darkest buttons (Google sign-in).
- **Muted Ink-60** (`#5C5070`): secondary/tertiary text, timestamps, footer labels.
- **Antique Border** (`#DED0B8`): hairline borders and dividers throughout.
- **Nawab Rose** (`#B05A4A`): the sole warning/destructive accent — delete-button hover, invalid-field border.

### Special Surface — the Night Court
- **Night Ink** (`#0A0710`) with **Night Bone** text (`#F8F2E8`): a deliberate, singular exception to the ivory-first rule, used only for the full-screen city selector and the city-switcher modal backdrop, where choosing a city is staged as a small ceremony.

### Named Rules
**The City-Swap Rule.** Only `--city-color`, `--city-color-light`, `--city-glow`, and `--city-bg` change when `data-city` changes. Ink, border, and text tokens never vary by city — the Nawabi identity stays constant while the accent shifts.

**The One Night Rule.** The near-black night-court palette (`#0A0710` / `#F8F2E8`) exists in exactly two places: the city selector and the city-switcher modal. It must never leak into the everyday ivory chat surface as a "dark mode."

## 3. Typography

**Display Font:** Fredoka (fallback: sans-serif)
**Body Font:** Google Sans (fallback: sans-serif)

**Character:** Fredoka's rounded, light-weight forms carry warmth at ceremonial moments (the app name, city names, hero titles); Google Sans stays legible and quiet everywhere transactional, so the interface never feels precious about routine tasks.

### Hierarchy
- **Display** (weight 300, `clamp(2.2rem, 7vw, 4rem)`, line-height 1, letter-spacing 0.1em): landing hero title, city-selector title. Ceremonial only.
- **Headline** (weight 400–500, 1.1rem–2rem, tight line-height): city card names, city-switcher title, modal headers.
- **Title** (weight 500, 0.78rem–1.05rem): sidebar logo, active tab label, section headings.
- **Body** (weight 400, 0.82rem–0.93rem, line-height 1.55, cap ~70ch in chat bubbles): chat messages, form fields, feedback text.
- **Label** (weight 500–600, 0.58rem–0.72rem, uppercase, letter-spacing 0.08em–0.15em): status pills, date-group labels, footer text, tags.

### Named Rules
**The Fredoka-For-Feeling Rule.** Fredoka is reserved for names and ceremonial titles (app name, city names, hero copy). The moment content becomes transactional — a button, a list item, a form field, a status message — it drops to Google Sans. Mixing the two inside one line of text is prohibited.

## 4. Elevation

Nawab AI is flat by default and rises only where a surface floats above the page: the chat input, the landing search box, the login card, and the two modal surfaces (city switcher, feedback success state). Depth comes from soft, diffuse, color-tinted shadows, never a hard black drop shadow, and it intensifies specifically in response to hover or focus rather than sitting heavy at rest.

### Shadow Vocabulary
- **Floating input** (`0 2px 12px rgba(0,0,0,0.06), 0 6px 24px rgba(0,0,0,0.04)`): chat input and landing box at rest.
- **Focus glow** (adds `0 0 0 3px color-mix(in srgb, var(--city-color) 14%, transparent)`): city-tinted ring on focus-within, replacing the flat border.
- **Card lift** (`0 1px 3px rgba(30,21,37,0.06), 0 8px 32px rgba(30,21,37,0.08)`): login card at rest.
- **Ceremonial modal** (`0 32px 80px rgba(0,0,0,0.4), 0 0 60px rgba(184,134,78,0.1)`): city-switcher card, floating over the night-court backdrop.
- **Hover lift** (`0 0 0 1px var(--card-color), 0 20px 60px var(--card-glow), 0 8px 24px rgba(0,0,0,0.5)`): city-selector cards on hover, paired with a `translateY(-8px) scale(1.02)` lift.

### Named Rules
**The Soft Ambient Lift Rule.** Shadows are always diffuse and tinted (city color or ink at low opacity), never plain black at full strength. Depth appears at hover/focus; nothing floats at rest except the handful of surfaces named above.

## 5. Components

Rounding is generous everywhere (8px–22px, or a full pill), giving every interactive element a soft, hand-finished edge rather than a sharp SaaS-grid one.

### Buttons
- **Shape:** pill (`999px`) for secondary/ghost actions and badges; `10px` radius for the one solid dark CTA (Google sign-in).
- **Primary (Google sign-in):** ink background (`#1C1525`), ivory text, full-width, `12px 32px` padding; hover deepens to `#2A1E3D` with a soft lifted shadow and `translateY(-1px)`.
- **Ghost (sidebar "new chat", retry buttons):** transparent background, `1px` antique-border stroke, pill radius; hover fills with Nawab Gold and flips text to ivory.
- **Icon-only (collapse, delete):** no border, minimal footprint; color shifts to rose (delete) or ink (collapse) on hover, never adds a background box at rest.

### Chips / Badges
- **City badge:** pill, parchment background, antique border, a small pulsing dot in the active city's color — the app's signature "you are here" indicator, present in the chat header at all times.
- **Tag / status chips:** small pill outline, low-opacity fills, used for search-context tags and thinking-panel tags.

### Cards / Containers
- **City-selector card:** dark surface, `16px` radius, glowing colored border and lifted shadow on hover, a floating symbol that drifts gently even at rest. The most theatrical component in the system — the ceremony of choosing a city.
- **Login / modal card:** ivory-white surface, `20px` radius, soft dual shadow, centered content, no border beyond the antique hairline.

### Inputs / Fields
- **Chat / landing textarea:** near-pill (`20px`–`22px` radius), white background, `1.5px` antique border; on focus the border and a soft glow both switch to the active city's color.
- **Feedback textarea:** same pattern; an invalid/warn state swaps the border and focus glow to Nawab Rose instead of gold.

### Navigation
- **Sidebar:** fixed `200px` parchment-tinted panel, Fredoka wordmark, Google Sans nav items in ink-60 that darken to ink on hover; collapses to a full-width overlay drawer with a scrim below `1024px`.

### Signature Component: City Selector / City Switcher
A full-screen (first visit) or modal (mid-session) ceremony: a near-black, hand-drawn hex-pattern backdrop (`#0A0710`) frames four glowing city cards, each carrying its own accent color, symbol, and local-language name. This is the one place the system leaves the ivory-and-gold "diwan" for a "night court," and it should stay unique to this moment.

## 6. Do's and Don'ts

### Do:
- **Do** reserve Fredoka for names and ceremonial titles; keep every transactional surface in Google Sans (**The Fredoka-For-Feeling Rule**).
- **Do** keep the ivory-and-gold palette as the default surface everywhere except the city selector and city-switcher, which alone may use the night-court palette (**The One Night Rule**).
- **Do** drive city differentiation entirely through `--city-color` / `--city-glow` / `--city-bg`, leaving ink, border, and text tokens untouched (**The City-Swap Rule**).
- **Do** keep shadows soft, diffuse, and color-tinted, intensifying only on hover/focus (**The Soft Ambient Lift Rule**).
- **Do** respect `prefers-reduced-motion` (already implemented globally) for any new animation.

### Don't:
- **Don't** default to flat dark mode, purple gradients, or a "robotic tech-bro" aesthetic anywhere outside the night-court exception — PRODUCT.md names this directly as an anti-reference.
- **Don't** let this read as a dry, bureaucratic government portal; warmth and plain language stay non-negotiable.
- **Don't** use `border-left`/`border-right` colored stripes as accents on cards or list items.
- **Don't** spread glassmorphism beyond the one purposeful use already present (the city-switcher's backdrop blur); ordinary cards and panels stay opaque.
- **Don't** introduce a hero-metric / dashboard-stat-tile template; this is a conversational tool, not an analytics surface.
