# Arqueo UI design concept

**Approved direction · Product first**

Arqueo is a stablecoin treasury on Stellar. Its first screen shows what the account does: a supplier payment of **800 USDC** exceeds the **500 USDC** single-signer limit, so the account requires the manager’s signature. Use this scene to show how payment controls work before inviting someone to explore the treasury.

[Open the approved HTML reference](./design-directions.html) and select **Product first**. The file runs offline and uses sample data. **Brand first** is the alternative explored during design.

## Layout and visual identity

- Give the desktop hero roughly three quarters of the viewport height. Place the pixel headline and payment summary on the left, with Arqueo’s orbital symbol rendered in ASCII on the right. On mobile, place the illustration below the copy and let the hero grow with its content.
- Preserve the original symbol’s two overlapping discs, inclined orbit and satellite. Use ivory for the front disc, graphite for the rear disc and amber for the orbit and satellite. Keep a small version next to the wordmark in the header.
- Use a charcoal background, a faint vertical grid and a low amber glow in the hero. Carry the palette through the app with graphite surfaces, fine dividers and ivory text.
- Use **Jacquard 12** for the Arqueo wordmark, **Silkscreen** for large display headlines, and **Arial** as the sans-serif in the reference for forms, tables and body text. Use monospace for identifiers and use tabular figures wherever amounts need to align.

| Color | Value | Use |
| --- | --- | --- |
| Carbon | `#101010` | Page background |
| Graphite | `#414244` | Rear disc and neutral palette reference |
| Ivory | `#EEE8DB` | Primary text and front disc |
| Amber | `#E5AA52` | Orbital details, focus and approval progress |

## Reference components

| Component | Design rule |
| --- | --- |
| Payment summary | Lead with the amount and asset. Keep the supplier, invoice and applicable limit close together. |
| Approval status | Show the named signers, the signature count and the next action. Pair the indicator with text such as `Manager signature required.` |
| Spending chart | Draw ordinary spending as a stepped cumulative line. Show the 30-day cap as a fixed dashed reference and label the amount and asset. |
| Payment history | Use compact rows and aligned amounts. In the auditor view, keep payment outcome, applied rule, signers and links to available transaction evidence easy to find. |
| Controls and forms | Use consistent labels and visible keyboard focus. Keep limits, suppliers and settings changes legible on the same dark surfaces. |

## Motion and accessibility

Keep the ASCII illustration still. Animate the approval track to the pending signature, then complete it when the second signature is added. Draw the spending line when its chart enters view. Honor reduced-motion preferences and keep amounts and approval states available as text throughout. Treat the ASCII characters as decorative for assistive technology.

## Visual references

- [Giga](https://giga.ai/) influenced the pixel typography, vertical grid and low amber glow.
- [Polar](https://polar.sh/) influenced the quiet treasury panels and animated charts.
- [xmcp](https://xmcp.dev/) influenced the blackletter wordmark, monochrome diagrams and character-based texture.
- [Starlight](https://www.lapa.ninja/post/starlight-money-2/) and [Atla AI](https://www.lapa.ninja/post/atla-ai/) were part of the initial visual reference set.
