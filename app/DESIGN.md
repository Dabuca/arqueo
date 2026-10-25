---
name: Arqueo
description:
  Internal controls for stablecoin treasuries on Stellar, drawn as the
  treasury's journal tape.
colors:
  cream-ground: "#ede8df"
  tape-stock: "#fbfaf6"
  ledger-green: "#0f3b30"
  ledger-green-deep: "#0a2a22"
  moss-muted: "#46645a"
  oxblood-reject: "#8a2a1e"
  green-rule: "rgb(15 59 48 / 22%)"
typography:
  display:
    fontFamily: "Jost, Futura, system-ui, sans-serif"
    fontSize: "clamp(2.6rem, 5.4vw, 4.6rem)"
    fontWeight: 500
    lineHeight: 1.02
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Jost, Futura, system-ui, sans-serif"
    fontSize: "clamp(1.9rem, 3.4vw, 2.75rem)"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Jost, Futura, system-ui, sans-serif"
    fontSize: "1.35rem"
    fontWeight: 500
    lineHeight: 1.3
  lead:
    fontFamily: "Jost, Futura, system-ui, sans-serif"
    fontSize: "1.2rem"
    fontWeight: 400
    lineHeight: 1.55
  body:
    fontFamily: "Jost, Futura, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Jost, Futura, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 500
    lineHeight: 1.4
  tape:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "0.8rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "tnum"
  tape-status:
    fontFamily: "Spline Sans Mono, ui-monospace, monospace"
    fontSize: "0.8rem"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "0.04em"
rounded:
  focus: "4px"
  slot: "6px"
  control: "10px"
  panel: "14px"
spacing:
  gutter: "clamp(16px, 4vw, 48px)"
  measure: "1200px"
  section: "clamp(4rem, 10vh, 7rem)"
  stack: "1.5rem"
  row: "0.85rem"
components:
  button-primary:
    backgroundColor: "{colors.ledger-green}"
    textColor: "{colors.cream-ground}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0.85rem 1.4rem"
  button-primary-hover:
    backgroundColor: "{colors.ledger-green-deep}"
    textColor: "{colors.cream-ground}"
  link-secondary:
    textColor: "{colors.ledger-green}"
    typography: "{typography.body}"
  ledger-table:
    textColor: "{colors.ledger-green}"
    typography: "{typography.body}"
    padding: "0.85rem 1rem 0.85rem 0"
  tape-entry:
    backgroundColor: "{colors.tape-stock}"
    textColor: "{colors.ledger-green}"
    typography: "{typography.tape}"
    padding: "0.85rem 0"
  tape-entry-rejected:
    backgroundColor: "{colors.tape-stock}"
    textColor: "{colors.oxblood-reject}"
    typography: "{typography.tape-status}"
  print-head:
    backgroundColor: "{colors.ledger-green}"
    rounded: "{rounded.panel}"
    padding: "1.1rem 1.25rem"
  green-band:
    backgroundColor: "{colors.ledger-green}"
    textColor: "{colors.cream-ground}"
    padding: "clamp(4rem, 10vh, 7rem) clamp(16px, 4vw, 48px)"
  pending-slot:
    backgroundColor: "{colors.cream-ground}"
    textColor: "{colors.ledger-green}"
    rounded: "{rounded.panel}"
    padding: "1.75rem 2rem"
---

# Design System: Arqueo

> Scope. This system is recorded from the landing at `/`
> (`src/pages/Landing.tsx`, `src/components/AuditTape.tsx`). The treasury demo
> (`/app`) and the debugger (`/debug`) still run on the Scaffold Stellar
> template styles (`app-lib/styles.css`) and are **not yet migrated**. New
> Arqueo screens follow this file, not the template.

## Overview

**Creative North Star: "The Treasury Journal"**

Arqueo looks like the paper journal roll of a cash register that never gets torn
off. The page is warm cream paper taken from the logo, set in deep green ink;
every payment prints as a line, approved or refused, and stays on the record.
The voice is a calm geometric sans; the evidence is a receipt-printer mono that
appears only where data is being printed.

Density is relaxed and editorial: one wide column with a 1200px measure,
generous vertical rhythm between sections, and tables ruled like a ledger rather
than boxed into cards. Ornament is limited to the material of the journal
itself: the print head, its slot, the punched feed holes, the dotted tear lines
between entries and the torn end of the roll. Colour does very little work; the
single non-brand hue is reserved for refusals.

The system rejects the fintech split hero with a product screenshot and three
feature cards. The proof is the tape, not a dashboard image.

**Key Characteristics:**

- Cream paper ground, deep green ink, one oxblood note for rejections only.
- Jost for every word of voice; Spline Sans Mono for printed data and inline
  code.
- Ledger tables with hairline green rules instead of cards.
- One full-bleed green band per page, used for the mechanism.
- The journal tape (print head, perforated stock, torn end) as the signature
  object.
- Soft, green-tinted ambient shadows only on physical objects.

## Colors

Two brand inks from the logo, a lighter tape stock, and one alarm note.

### Primary

- **Ledger Green** (`ledger-green`): all type, table rules at full strength, the
  primary button, the print head body, and the full-bleed "how it works" band.
  It is the brand's ink, not an accent.
- **Ledger Green Deep** (`ledger-green-deep`): hover state of the primary button
  only.

### Tertiary

- **Oxblood Reject** (`oxblood-reject`): the status line of a rejected entry on
  the tape. Nothing else.

### Neutral

- **Cream Ground** (`cream-ground`): page background, matched to the paper of
  the logo symbol; also text colour on green surfaces and the colour punched
  through the tape's feed holes.
- **Tape Stock** (`tape-stock`): the journal paper, a step lighter than the
  ground so the roll reads as an object hanging in front of the page.
- **Moss Muted** (`moss-muted`): secondary text: table headers, fine print, the
  honesty note, the footer.
- **Green Rule** (`green-rule`): hairline dividers between ledger rows and above
  the footer. On the green band the same role is a cream hairline at 25%
  opacity, and supporting text drops to cream at 82%.

### Named Rules

**The Oxblood Is a Verdict Rule.** Oxblood marks a payment the account refused.
It never appears on buttons, links, headings, alerts unrelated to a refusal, or
decoration.

**The One Drench Rule.** A page carries at most one full-bleed Ledger Green
band, reserved for explaining the mechanism. Every other section sits on Cream
Ground.

## Typography

**Display Font:** Jost (with Futura, system-ui) **Body Font:** Jost (with
Futura, system-ui) **Label/Mono Font:** Spline Sans Mono (with ui-monospace)

**Character:** Jost's crossbar-less, circle-built geometry echoes the ARQUEO
wordmark and keeps the voice quiet and exact. Spline Sans Mono is the printer:
tabular, slightly technical, used where something is being recorded.

### Hierarchy

- **Display** (500, clamp 2.6–4.6rem, 1.02, -0.03em): the hero headline, capped
  at 15ch, balanced.
- **Headline** (500, clamp 1.9–2.75rem, 1.1, -0.02em): section titles.
- **Title** (500, 1.35rem, 1.3): step titles in the green band and small section
  titles such as the honesty note.
- **Lead** (400, 1.2rem, 1.55): the hero explainer and the pending video slot.
- **Body** (400, 1.0625rem, 1.6): running text, max 62ch. Section intros step up
  to 1.15rem.
- **Label** (500, 0.9rem): ledger column headers in Moss Muted; table captions
  run at 1.15rem 500.
- **Tape** (Spline Sans Mono 400, 0.8rem, 1.5, tabular figures): every printed
  line on the journal. Field names print uppercase (PAY, TO, RULE, SIGNED)
  because that is how a receipt printer prints them.
- **Tape Status** (Spline Sans Mono 700, 0.8rem, +0.04em): APPROVED / REJECTED.

Headings are never bolder than 500. Large step numerals in the green band are
Jost 400 at 2.5rem (1.75rem on phones) with tabular figures.

### Named Rules

**The Printer Speaks Mono Rule.** Spline Sans Mono is for printed data (tape
entries, hashes, amounts) and inline `code`. Headings, buttons, navigation and
prose are always Jost.

**The Tabular Figures Rule.** Any column of amounts or times uses tabular
numerals so the ledger lines up.

## Layout

A single centred measure of 1200px with a fluid inline gutter (16px on phones up
to 48px); the inline padding is `max(gutter, (100% - measure) / 2)`, so
full-bleed bands keep their content aligned with the rest of the page. Sections
are separated by fluid vertical padding (4–7rem, scaled by viewport height)
rather than by borders or containers.

The hero is a two-column grid (1.15fr pitch : 0.85fr tape) with the tape filling
nearly the full viewport height (up to 54rem, at least 34rem) and running off
its bottom edge. Below 900px it collapses to one column and the order becomes
headline, tape (17rem tall), lead, actions, fine print, so a refused payment
reaches the first phone screen. Below 640px the section nav hides, leaving the
brand and the header action.

Paired ledgers sit in a two-column grid with a 3rem gap and stack below 900px.
Spacing rhythm inside blocks: 1.5rem between stacked hero elements, 0.85rem row
padding in tables, 1.5rem padding per step row.

## Elevation & Depth

Flat by default. Pages, sections and tables carry no shadow; depth comes from
tonal stepping (tape stock in front of cream ground) and the full-bleed green
band. Shadows appear only under objects that physically hang or protrude, and
they are soft, offset downward and tinted with Ledger Green, never black.

### Shadow Vocabulary

- **Button lift** (`box-shadow: 0 8px 18px -10px rgb(15 59 48 / 60%)`): under
  the primary button.
- **Print head** (`box-shadow: 0 10px 24px -12px rgb(15 59 48 / 55%)`): under
  the printer body.
- **Hanging paper** (`box-shadow: 0 18px 32px -20px rgb(15 59 48 / 45%)`): under
  the tape stock.

### Named Rules

**The Only Objects Cast Shadows Rule.** A shadow means the thing is a physical
object (button, printer, paper). Sections, tables and text blocks never get one.

## Shapes

Gently rounded where the user acts or the object is machined, square where it is
paper. Focus outlines round at 4px; the primary button at 10px; the print head
at 14px on top and 6px at the bottom; the video frame and pending slot at 14px.
The tape paper has no radius: its long edges are punched with feed holes (2.5px
holes every 16px) and its end is torn with a 14px × 9px zigzag mask. Entries on
the tape are divided by a 2px dotted rule; ledger rows by a 1px solid hairline.
The logo symbol's square edge is faded with a radial mask so the disc sits
directly on the cream.

## Components

### Buttons

Quiet and solid, one per view region.

- **Shape:** gently rounded (10px).
- **Primary:** Ledger Green fill, Cream Ground text, Jost 500, padding 0.85rem ×
  1.4rem (0.75rem × 1.1rem on phones), with the button-lift shadow.
- **Hover / Focus:** background shifts to Ledger Green Deep over 160ms ease-out;
  focus shows a 2px Ledger Green outline offset 3px.
- **Secondary:** a plain underlined text link in Jost 500 beside the primary
  (1px underline, 0.25em offset). There is no outlined or ghost button.

### Ledger Tables

Comparison and matrix content is a ruled table, not a card grid.

- Full width, collapsed borders, left aligned, tabular numerals.
- Header row in Moss Muted Label, with a full-strength Ledger Green rule beneath
  it; body rows divided by Green Rule hairlines.
- Row headers (first column) in Jost 500, no wrap on wide screens.
- Captions sit above, left aligned, 1.15rem 500 (visually hidden when the
  heading already names the table).

### Navigation

- Header row: logo symbol (52px) and wordmark (110px) at the left, section links
  at the right in body Jost with no underline until hover, then the header
  action ("Open the testnet demo") in Jost 500.
- Below 640px section links hide; brand and header action spread to the edges.
- A skip link slides in from the top on focus, Ledger Green with cream text.

### Green Band

The single drenched section. Ledger Green background, Cream Ground text,
selection colours inverted. Holds an ordered list of steps: a large Jost 400
numeral in a 4rem column (2.5rem on phones), a Title, and body text in cream at
82%, each step separated by a cream hairline at 25%.

### Pending Slot

For content that does not exist yet (the demo video). A 1px dashed Ledger Green
border, 14px radius, 1.75rem × 2rem padding, a Lead sentence saying what is
coming and a primary button to the working alternative. Honest placeholders are
dashed; finished media is a borderless 16:9 frame at 14px radius, max 960px.

### Journal Tape (signature)

The treasury journal as a physical roll.

- **Print head:** Ledger Green body (max 27rem wide, 14px/6px radius, print-head
  shadow) with a tiny cream status light that blinks four times while lines
  print, and a dark slot the paper hangs from.
- **Paper:** Tape Stock, max 23rem wide, tucked 4px into the slot, punched feed
  holes down both edges, torn bottom edge, hanging-paper shadow; it overflows
  and bleeds off its frame.
- **Entries:** newest first under the head. Each entry is a disclosure: three
  mono lines (time and amount; recipient and rule; signers), then the status in
  Tape Status (APPROVED with the transaction hash, or REJECTED in Oxblood with
  the human reason). Opening it lists the checks the account ran. The newest
  line carries a faint green wash (6%).
- **Motion:** each entry feeds in by expanding its row height and fading up over
  900ms (`cubic-bezier(0.16, 1, 0.3, 1)`), staggered 1200ms apart. Under
  `prefers-reduced-motion` all tape motion stops and every line is simply
  printed.
- **Footer of the roll:** a centred uppercase mono colophon at 70% opacity
  naming the journal and stating it is testnet and illustrative.

## Do's and Don'ts

### Do:

- **Do** set every surface on Cream Ground (#ede8df) with Ledger Green (#0f3b30)
  ink; use Tape Stock (#fbfaf6) only for the journal paper.
- **Do** reserve Oxblood (#8a2a1e) for refused payments, per The Oxblood Is a
  Verdict Rule.
- **Do** present matrices, comparisons and payment lists as ruled ledger tables
  with tabular numerals.
- **Do** print payment data (amounts, hashes, rules, signers) in Spline Sans
  Mono, and everything else in Jost at weight 400 or 500.
- **Do** show rejected attempts alongside approved ones wherever payments are
  listed; the record is never trimmed.
- **Do** mark unfinished content with the dashed pending slot and a working
  alternative.
- **Do** honour `prefers-reduced-motion` by stopping print animations and
  showing the final state.

### Don't:

- **Don't** build a split hero with a product screenshot and a row of three
  feature cards.
- **Don't** use oxblood, red or any warning hue for anything other than a
  refusal.
- **Don't** add a second full-bleed green band to a page.
- **Don't** set headings, buttons or prose in the mono face.
- **Don't** put shadows on sections, tables or text blocks, or use black or hard
  offset shadows.
- **Don't** add ornament beyond the journal's own material (print head, feed
  holes, dotted tear lines, torn edge).
- **Don't** carry the Scaffold Stellar template styles into new Arqueo screens.
