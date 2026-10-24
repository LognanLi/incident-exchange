# Design Research — Incident Exchange

_Researched 2026-10-24. Method: I fetched linear.app and raycast.com live. WebFetch converts pages to text and drops CSS, so it can't see colors, fonts, or motion. The notes below come from publicly documented, widely observed traits of each product (its marketing site plus the app). Treat specific values as approximations unless they are marked as a recommendation._

## 1. Site-by-site patterns worth borrowing

| # | Site | What to borrow |
|---|------|----------------|
| 1 | **linear.app** (fetched) | Dark near-black canvas (~#08090A) and Inter Display headings with tight negative tracking. Product screenshots are the hero art, with "Fig 0.1"-style captions and a pill "New →" badge above the H1. The app has a 220–240px left sidebar with 28px rows and a ⌘K palette. Sections fade up with a stagger. |
| 2 | **stripe.com** | Animated mesh gradient in the hero. Hairline grid lines tie sections together. Body copy uses a slate scale (#425466) and accents are indigo (#635BFF). Hover menus open with a morphing caret and a size transition. Docs use a 3-column layout: left nav, content, right code. |
| 3 | **vercel.com** (Geist) | Strict monochrome (#000/#FFF, gray scale 100–1000) with Geist Sans and Geist Mono. 1px borders replace shadows. Its design system documents a 4px spacing grid, 6px/12px radii, and toasts that stack bottom-right. Dashboards use horizontal tabs whose underline slides to the active tab. |
| 4 | **raycast.com** (fetched) | Keyboard-first identity: a big keycap graphic and bold one-word lead-ins ("Fast." "Reliable."). A glassy gradient sits behind dark cards. Extension grids are split by category tabs. The command palette is the product, so copy its list row (icon, title, subtitle, shortcut). |
| 5 | **arc.net** | A vertical sidebar is the main navigation. Colorful, playful gradients appear, and corners are generous (12–16px). Springy micro-interactions. Onboarding goes one question per screen with a big friendly headline. |
| 6 | **notion.com** | Warm off-white (#FFFFFF / #F7F6F3), hand-drawn illustrations, and plain-language copy. Empty states give a one-line explanation plus a template to start from. Hovering a sidebar row reveals its actions. Its "/" command menu teaches features where you use them. |
| 7 | **framer.com** | Dark theme with heavy scroll-linked motion: sections scale and parallax as they enter. Big type with tight leading. The motion is excellent, but use it sparingly in a working app. |
| 8 | **apple.com** | Lots of whitespace. SF Pro with large display sizes (48–80px) and very short headlines. Scroll-driven reveals use ease-out curves of about 600–800ms. Sticky sub-nav per product, and a single blue CTA (#0071E3). |
| 9 | **superhuman.com** | Speed-focused UI: keyboard hints shown inline, an onboarding coach that teaches shortcuts, and celebration states ("Inbox Zero"). Restrained palette with a purple accent. |
| 10 | **mercury.com** | Calm fintech look: soft gray-blue neutrals, serif display headings alongside a sans body, and large numerals for balances. Tables are quiet with lots of row padding. It builds trust through restraint, which suits a money product. |
| 11 | **ramp.com** | Lime/yellow accent on near-black and white. Hero numbers count up ("saves 5%"). The app has approval flows with clear status pills and a spend-limit UI. Good reference for buyer spend controls. |
| 12 | **clerk.com** | Polished component previews in cards with gradient borders. Soft purple glow behind key cards. Its pricing table and auth UI set the bar for small trust details (padlock and verified badges). |
| 13 | **resend.com** | Minimal black with silky, slow fade-ins (about 1s) and a glowing 3D object in the hero. Monospace accents for technical details. Long-form docs are very readable. |
| 14 | **supabase.com** | Dark slate with a green accent (#3ECF8E). Its dashboard has a collapsible icon-only left rail that expands on hover, a good model for a collapsed sidebar. Pre-made SQL snippets act as onboarding. |
| 15 | **vanta.com** | Compliance aimed at non-experts: progress rings ("72% SOC 2 ready"), checklists, and framework logos as trust badges. Dashboards show plain-English test names. The trust center has an "Request access" + NDA flow. |
| 16 | **drata.com** | Similar compliance UX, with control status shown as pass/fail chips and a readiness percentage. Clean white cards on a light gray (#F5F7FA) background. Onboarding is a "Get started" checklist with progress bars. |
| 17 | **1password.com** | Friendly, colorful security brand that avoids the scary dark-hacker look. Watchtower uses severity colors (red, amber, green) plus plain explanations. Reassuring copy ("Here's what to do"). |
| 18 | **cloudflare.com** | Orange accent (#F38020) and dense but organized information. The dashboard has a left sidebar with grouped sections and section headers. Status pills and analytics sparklines. |
| 19 | **figma.com** | Bold color blocks, variable fonts, and playful cursors. The app has a 240px left panel with layered tree indentation and a properties panel on the right. Multiplayer presence avatars. |
| 20 | **posthog.com** | Deliberately quirky (hedgehogs, a desktop-OS metaphor) with very transparent pricing calculators. Shows that personality builds memorability, but our trust-heavy domain should stay calmer. |
| 21 | **attio.com** | Excellent data-table UX: sticky headers, inline chips, and a record page with a vertical tab rail. Skeletons shimmer softly. Light gray borders (#EEEFF1) and 8px radii. |
| 22 | **plaid.com** | Trust-forward fintech: consent screens that list exactly what data is shared, a step progress indicator, and big "Continue" buttons. Use it as the template for an unlock or purchase consent modal. |
| 23 | **wiz.io** | Security product drawn as a graph of attack paths, with severity colors and toxic-combination callouts. Pastel blues and purples instead of hacker-green. |
| 24 | **snyk.io** | Developer security with severity badges (C/H/M/L with fixed colors), "fix" PR CTAs, and plain-English vulnerability explanations next to the technical detail. |

**Common threads:**
1. One accent color on neutral surfaces.
2. Inter or Geist-style sans, tight tracking on headings.
3. 1px borders rather than heavy shadows.
4. Motion that is short and ease-out, used for entering and for feedback, never decoration in a working view.
5. Keyboard palette.
6. Status as colored pills.
7. Plain-language helper text next to technical terms (Vanta, 1Password, Snyk).

---

## 2. Design system for Incident Exchange

Direction: **"calm trust."** A light-first UI that reads like Mercury and Vanta, with Linear's density and keyboard features. A dark sidebar anchors the layout. Everything is implemented with CSS custom properties and plain React.

### 2.1 Palette (CSS variables)

```css
:root {
  /* Neutrals */
  --bg: #F7F8FA;          /* app canvas */
  --surface: #FFFFFF;     /* cards */
  --surface-2: #F1F3F6;   /* inset, hover */
  --border: #E4E7EC;
  --border-strong: #D0D5DD;
  --text: #101828;        /* primary */
  --text-2: #475467;      /* secondary */
  --text-3: #98A2B3;      /* placeholder, meta */

  /* Sidebar (dark anchor) */
  --nav-bg: #0B1220;
  --nav-text: #A6B0C3;
  --nav-text-active: #FFFFFF;
  --nav-hover: rgba(255,255,255,.06);

  /* Brand */
  --accent: #4F46E5;       /* indigo: trust and action */
  --accent-hover: #4338CA;
  --accent-soft: #EEF2FF;
  --accent-2: #06B6D4;     /* cyan, only for gradients */

  /* Semantic */
  --success: #12B76A;  --success-soft: #ECFDF3;   /* fit, verified, paid */
  --warning: #F79009;  --warning-soft: #FFFAEB;   /* partial fit, AMBER */
  --danger:  #F04438;  --danger-soft:  #FEF3F2;   /* mismatch, RED */
  --info:    #2E90FA;  --info-soft:    #EFF8FF;

  /* TLP 2.0 labels (FIRST spec colors, on black chip) */
  --tlp-red: #FF2B2B; --tlp-amber: #FFC000; --tlp-green: #33FF00; --tlp-clear: #FFFFFF;

  --gradient-brand: linear-gradient(135deg, #4F46E5 0%, #06B6D4 100%);
}
```

Use the accent for one primary action per view. Fit/mismatch is always shown as a color plus an icon plus a word, never color alone (WCAG 1.4.1).

### 2.2 Typography
- Font: `Inter, "Inter var", system-ui, -apple-system, "Segoe UI", sans-serif`. Mono: `"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace` for IOCs and commands.
- Use `font-feature-settings: "cv11","ss01"; font-variant-numeric: tabular-nums;` for prices and counts.

| Token | px / line-height | Weight | Tracking | Use |
|---|---|---|---|---|
| display | 48 / 56 | 600 | -0.02em | landing hero |
| h1 | 32 / 40 | 600 | -0.015em | page title |
| h2 | 24 / 32 | 600 | -0.01em | section |
| h3 | 18 / 28 | 600 | 0 | card title |
| body | 15 / 24 | 400 | 0 | default |
| small | 13 / 20 | 400/500 | 0 | meta, helper text |
| micro | 11 / 16 | 600 | 0.06em uppercase | eyebrow labels, sidebar group headers |

### 2.3 Spacing, radii, shadows
- Spacing (4px grid): `--s-1:4px --s-2:8px --s-3:12px --s-4:16px --s-5:20px --s-6:24px --s-8:32px --s-10:40px --s-12:48px --s-16:64px`.
- Card padding is 20–24px. The gap between cards is 16px. Max content width is 1200px, and 720px for reading pages (guide body).
- Radii: `--r-sm:6px` (chips, inputs), `--r-md:10px` (buttons, cards), `--r-lg:14px` (modals, hero cards), `--r-full:999px` (pills, avatars).
- Shadows:
  ```css
  --shadow-xs: 0 1px 2px rgba(16,24,40,.05);
  --shadow-sm: 0 1px 3px rgba(16,24,40,.08), 0 1px 2px rgba(16,24,40,.04);
  --shadow-md: 0 4px 12px -2px rgba(16,24,40,.08), 0 2px 4px -2px rgba(16,24,40,.04);
  --shadow-lg: 0 16px 32px -8px rgba(16,24,40,.14), 0 4px 8px -4px rgba(16,24,40,.06);
  --ring: 0 0 0 3px rgba(79,70,229,.25);   /* focus-visible */
  ```

### 2.4 Motion recipes

```css
:root {
  --ease-out: cubic-bezier(.16,1,.3,1);      /* expo-out: entrances */
  --ease-in-out: cubic-bezier(.65,0,.35,1);  /* moves, indicator slides */
  --ease-spring: cubic-bezier(.34,1.56,.64,1);/* small overshoot: success pop */
  --dur-1: 120ms; --dur-2: 200ms; --dur-3: 320ms; --dur-4: 600ms;
}
```

1. **Staggered fade-up reveal** (search results, cards on page load):
   ```css
   @keyframes fadeUp { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:none; } }
   .reveal { animation: fadeUp var(--dur-3) var(--ease-out) both; animation-delay: calc(var(--i, 0) * 40ms); }
   ```
   In React, set `style={{'--i': Math.min(index, 8)}}`. Cap the stagger at 8 items (320ms).
2. **Hover lift** (guide cards): `transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out), border-color var(--dur-2);` and on `:hover`, `transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--border-strong);`.
3. **Gradient border** (featured or "best fit" card):
   ```css
   .card--featured { border: 1px solid transparent;
     background: linear-gradient(var(--surface),var(--surface)) padding-box, var(--gradient-brand) border-box; }
   ```
   Optionally rotate the gradient with `@property --angle` over 6s linear infinite, and only on the landing page.
4. **Number count-up** (earnings, guides sold, fit score): use `requestAnimationFrame` over 800ms with easeOutExpo `1 - 2**(-10t)`. Start it when the element enters view via `IntersectionObserver`. Use `tabular-nums` so the width doesn't jitter.
5. **Scroll reveal**: `IntersectionObserver` with `threshold: .15` and `rootMargin: '0px 0px -10% 0px'`, which adds `.is-visible`. The transition is opacity plus `translateY(16px)` over 600ms ease-out. It runs once, then unobserve.
6. **Skeleton shimmer** (search loading, at least 300ms so it doesn't flash):
   ```css
   .skeleton { background: linear-gradient(90deg, var(--surface-2) 25%, #E9ECF1 37%, var(--surface-2) 63%); background-size: 400% 100%; animation: shimmer 1.4s ease infinite; border-radius: var(--r-sm); }
   @keyframes shimmer { from { background-position: 100% 50%; } to { background-position: 0 50%; } }
   ```
7. **Command palette (⌘K)**: the backdrop fades in at 150ms. The panel goes from `opacity:0; transform: scale(.98) translateY(-4px)` to identity in 200ms with `--ease-out`. The active row background moves instantly, with no delay. Close in 120ms.
8. **Toast**: enters from the bottom-right with `translateY(12px)` going to 0 plus fade, 240ms `--ease-out`. It auto-dismisses after 4s, and the timer pauses on hover. Stack up to 3 with an 8px gap. Use `role="status"` and `aria-live="polite"`.
9. **Unlock success**: the padlock icon swaps to an open lock, scales 0.8 → 1, and runs 400ms `--ease-spring`. The blurred guide preview goes from `filter: blur(6px)` to `blur(0)` over 600ms `--ease-out`.
10. **Fit meter fill**: the bar width goes from 0 to the score% over 700ms `--ease-out`. The color is stepped, not gradient: ≥70 success, 40–69 warning, <40 danger.

**Reduced motion** (required):
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important;
    transition-duration: .01ms !important; scroll-behavior: auto !important; }
  .reveal, .is-visible { opacity: 1 !important; transform: none !important; }
}
```
In JS, check `matchMedia('(prefers-reduced-motion: reduce)').matches` and skip count-ups by rendering the final value immediately.

### 2.5 Vertical tab sidebar spec
- **Widths:** 240px expanded on desktop (≥1024px), 64px icon rail on tablet (768–1023px) that expands to 240px as an overlay on hover or focus, and an off-canvas drawer on mobile (<768px).
- **Structure, top to bottom:**
  1. Logo and workspace switcher (56px tall).
  2. "Search ⌘K" button.
  3. Groups with micro uppercase headers. **Find help:** Search incidents, Saved, Purchases. **Contribute:** Submit a guide, My guides, Earnings. **Org:** Team, Billing, Audit log.
  4. Pinned at the bottom: Help and glossary, profile.
- **Row:** 36px tall, 12px horizontal padding, a 10px gap between a 18px icon and the label, 14px/500 text, 6px radius. Hover uses `--nav-hover` with a 120ms transition.
- **Active indicator:** a single absolutely positioned `<span class="nav-indicator">` (3px wide, 20px tall, `--gradient-brand`, radius 2px) on the left edge. It animates `transform: translateY(var(--y))` over 320ms `--ease-in-out`. Compute `--y` from the active row's `offsetTop` in a `useLayoutEffect`. The active row also gets `background: rgba(255,255,255,.08)` and white text. Use `aria-current="page"`.
- **Icons:** use inline SVG with a 1.5px stroke, Lucide-style. Paste the SVG paths directly; no library is needed. Suggested set: search, bookmark, receipt, upload, file-text, wallet, users, credit-card, scroll (audit), help-circle.
- **Badges:** right-aligned count pill (11px, `--accent` background), e.g. "2" for new matches.
- **Keyboard:** `g` then `s` goes to Search and `g` then `e` goes to Earnings (show these hints in tooltips). Arrow keys move within the nav when it has focus.
- **Mobile:** a hamburger in a 56px top bar opens the drawer. It slides in with `translateX(-100%)` going to 0 over 280ms `--ease-out`, over a 40% black scrim. Close it with Esc, a scrim click, or by choosing a route. Trap focus inside it. A bottom tab bar is an alternative with 4 items (Search, Purchases, Submit, Earnings) and is preferable for the demo on phones.
- **Collapsed rail tooltips:** on hover, show the label to the right after a 300ms delay, with a 120ms fade.

### 2.6 Empty states and onboarding for non-technical users
- **Plain-language first, jargon second.** Write "Our database was encrypted and held for ransom", with "(ransomware)" shown as a glossary chip. In search, use the placeholder: _"Describe what's happening, e.g. 'customers can't log in and we see lots of password resets'"_.
- **Glossary tooltips:** dotted underline (`text-decoration: underline dotted var(--text-3)`) on terms like TLP, IOC, ATT&CK, RTO, and SOC 2. On hover or focus, show a 280px popover with a one-sentence definition and a "Learn more" link. Use `aria-describedby`. Keep a single `glossary.js` map so the copy stays consistent.
- **Empty state anatomy:** a 48px soft-tinted icon circle, an h3 that names the benefit, one sentence of body text, a primary CTA, and a secondary text link.
  - _No purchases yet:_ "Guides you unlock show up here. Start by describing your incident, and we'll find teams who've handled it before." [Search incidents]
  - _No guides submitted:_ "Turn a past incident into income. You keep 80% of every sale, and we remove sensitive details before anything is published." [Submit your first guide] · "See an example guide"
  - _No search results:_ suggest 3 example queries as chips and offer "Post a request, and we'll notify you when a matching guide is published."
- **Progress cues:**
  - The submission wizard shows a step indicator with the steps (1) What happened, (2) How you fixed it, (3) Remove sensitive info, (4) Review and price.
  - Autosave shows "Saved · 2s ago".
  - A "Getting started" checklist card on the dashboard has 3–5 items with a progress ring that fills (Vanta/Drata pattern). It dismisses once complete.
- **Explain the money and safety up front:** show "You pay $X once. You get the full guide, the evidence, and a PDF copy. Refunds within 7 days if it doesn't fit." A sanitization badge reads "Reviewed: no customer names, IPs, or secrets". Show the fit/mismatch rationale in sentences ("Matches: same cloud (AWS), same symptom (login spike). Different: they use Okta, you use Azure AD.").
- **Confirm destructive or paid actions** with a Plaid-style consent modal that lists exactly what happens.
- **Accessibility:** the focus ring is `--ring` on every interactive element. Contrast is at least 4.5:1 for body text (`--text-2` on white is about 7.6:1). Hit targets are at least 36px, and 44px on mobile.

## Live-fetch evidence (2026-10-24, lead engineer)

HTML of 24 sites was fetched with curl and scanned for theme colors, font families, motion declarations, and sidebar markup (text-only signals; visuals not rendered). drata.com returned a 5 KB bot-protection page.

| Site | theme-color | Fonts seen | CSS motion refs | Sidebar markup |
| --- | --- | --- | --- | --- |
| linear.app | #08090a | custom sans + mono var | 454 | yes |
| stripe.com | — | Source Code Pro (+ custom sans) | 36 | yes |
| vercel.com | #FAFAFA / #000 | Geist sans/mono vars | 293 | no |
| raycast.com | — | Geist Mono, JetBrains Mono | 6 | yes |
| arc.net | #3139FB | Space Mono + sans vars | 6 | yes |
| notion.com | — | NotionInter | 0 (JS-driven) | no |
| framer.com | — | Geist, EB Garamond | 130 | yes |
| apple.com | — | (SF via system) | 0 inline | no |
| superhuman.com | — | custom | 2 | yes |
| mercury.com | — | Arcadia Display / Text | 333 | no |
| ramp.com | — | custom | 358 | no |
| clerk.com | — | Suisse Intl | 346 | no |
| resend.com | #000000 | Helvetica | 148 | no |
| supabase.com | — | heading var | 5,910 | yes |
| vanta.com | — | custom | 31 | no |
| 1password.com | — | custom | 20 | no |
| cloudflare.com | #ff4801 | sans var | 576 | no |
| figma.com | #ffffff | global sans/mono vars | 132 | yes |
| posthog.com | #E5E7E0 | system + Charter | 655 | yes |
| attio.com | — | custom | 1,338 | yes |
| plaid.com | #ffffff | Cern, Plaid Sans, Inconsolata | 237 | no |
| wiz.io | — | custom | 247 | no |
| snyk.io | — | custom | 66 | no |

Most frequent easing curves across linear/attio/supabase/cloudflare/clerk/ramp/mercury/posthog/vercel: `cubic-bezier(0.33,1,0.68,1)` (ease-out-cubic, 61×), `cubic-bezier(0.4,0.36,0,1)` (40×), `cubic-bezier(0.25,0.46,0.45,0.94)` (35×), `cubic-bezier(.4,0,.2,1)` (28×), `cubic-bezier(0.22,1,0.36,1)` (ease-out-quint, 16×).

**Applied to Incident Exchange:** near-neutral canvas + near-black sidebar (Linear/Vercel/Resend), one saturated accent (Arc/Cloudflare pattern, we use indigo), sans + mono pairing for data (Geist/Plaid/Raycast), product-app vertical sidebar (Linear/Supabase/Attio/Figma/PostHog), motion with ease-out-cubic/quint at 150–400 ms, all disabled under `prefers-reduced-motion`.

## Visual research round (rendered screenshots, 2026-10-24)

12 homepages were rendered in Chrome at 1280×800 and compared on one contact sheet: attio.com, basecamp.com, cal.com, culturedcode.com/things, linear.app, mercury.com, notion.com, posthog.com, raycast.com, resend.com, stripe.com, vercel.com.

What the least "generated-looking" sites share (Attio, Cal.com, Things, Vercel, Notion, Basecamp, Resend):
- **Warm white / near-white canvas, near-black text, black primary buttons**; secondary buttons are white with a hairline border.
- **No decorative gradients or glows**; color is functional (status, one brand mark), not atmospheric. (Stripe/Raycast use gradients, but as a signature brand asset — copying that look is what reads as “AI”.)
- **The product is the hero image** (Cal.com's booking widget, Attio's app window, Basecamp's project) rather than abstract art.
- **Confident, tightly tracked headlines**; Resend and Basecamp add an editorial serif.
- **Hairline 1px borders, near-zero shadows**, generous whitespace, small grey navigation.

### Applied in design v3 (`src/styles.css`, last section)
| Decision | Source pattern |
| --- | --- |
| Canvas #fafaf9, surface #fff, ink #111, secondary text #3f3f46/#6b6b73, hairlines #ebebea | Cal.com, Things, Vercel |
| Ink-black primary buttons, white hairline secondary | Attio, Cal.com, Vercel |
| Light app-chrome sidebar (#f4f4f2) with the active tab as a white raised row | Attio, Notion |
| One functional green (#1f7a4d) for “good/verified”, amber only for “may not apply”; status shown as neutral chips with a colored dot | Linear, Attio |
| Serif display headline on the home hero | Resend, Basecamp |
| Hero shows a real product moment (symptom search with Strong overlap / May not apply) | Cal.com, Attio |
| Motion: 8 px fade-up (ease-out-cubic 420 ms), staggered list reveal (60 ms steps), border/shadow hover (no bounce), sliding tab indicator, toast/palette pop (ease-out-quint), count-up, caret blink — all off under reduced motion | Linear, Vercel, Attio |
| Removed: indigo→cyan gradients, glowing hero, gradient borders/meters | (avoiding the generic “AI” look) |

TLP labels keep their official FIRST colors (black with green/amber text) because they are a security standard, not decoration.
