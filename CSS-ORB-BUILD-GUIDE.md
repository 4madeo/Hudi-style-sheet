# Build the HUDI orb in CSS

Give this entire file to your implementation agent. It is self-contained; no access to the HUDI repository is required.

## Agent instructions

Implement a reusable, static, glossy HUDI orb using the HTML and CSS below. Preserve the supplied geometry, gradient stops, layer order, and shadow proportions. The sphere material must be CSS, with an optional transparent image for a company logo. No canvas, WebGL, image of a sphere, animation library, or framework is required. Adapt the markup to your application's framework if necessary.

The intended appearance is a vivid circular body with a lighter upper half, soft coloured depth, a broad white upper reflection, a smaller bright cap, two fine inset edge rings, and a soft radial highlight in the lower half that gives the body a clear, illuminated appearance. Keep it circular at every size. Do not add motion unless requested.

This guide combines the restored bottom radial highlight from the supplied Figma reference with the material rules from `components/orb/orb.css` in the standalone HUDI Orb System. The optional logo markup is simplified to work without React or JavaScript. The palette here uses the stylesheet's default pink colours; automatic brand-colour derivation and the React component's logo loading/fallback logic are outside this CSS recipe.

## 1. Add the HTML

This is a complete bare orb. Link the CSS from the next section as `orb.css`, or place it in a `<style>` element.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>HUDI CSS orb</title>
    <link rel="stylesheet" href="orb.css">
  </head>
  <body>
    <div
      class="hudi-orb"
      data-orb-theme="light"
      data-orb-glow="false"
      role="img"
      aria-label="Glossy pink orb"
      style="--hudi-orb-size: 240px;"
    >
      <span class="hudi-orb__rings" aria-hidden="true"></span>
      <span class="hudi-orb__bottom-highlight" aria-hidden="true"></span>
    </div>
  </body>
</html>
```

## 2. Copy this CSS into orb.css

The base material is copied from the source; the bottom radial highlight restores the supplied Figma reference’s `Ellipse 327`. The final rules add layout isolation and a standalone optional logo. Keep both pseudo-elements available for the upper reflections and use a separate span for the bottom highlight.

```css
.hudi-orb {
  --_hudi-orb-size: var(--hudi-orb-size, 460px);
  --_hudi-orb-ring-width: var(--hudi-orb-ring-width, calc(var(--_hudi-orb-size) * .006));
  --_hudi-orb-ring-depth: var(--hudi-orb-ring-depth, calc(var(--_hudi-orb-ring-width) * 2));
  --_hudi-orb-base: var(--hudi-orb-base, #ec009e);
  --_hudi-orb-sheen: var(--hudi-orb-sheen, #ff7dec);
  --_hudi-orb-shadow: var(--hudi-orb-shadow, rgba(134, 0, 98, .4));
  --_hudi-orb-dark-ring: var(--hudi-orb-dark-ring, color-mix(in srgb, var(--_hudi-orb-shadow) 75%, rgba(0, 0, 0, .42)));
  --_hudi-orb-light-ring: var(--hudi-orb-light-ring, color-mix(in srgb, color-mix(in srgb, var(--_hudi-orb-sheen) 62%, #fff) 72%, transparent));
  --_hudi-orb-outer-ring: var(--_hudi-orb-dark-ring);
  --_hudi-orb-inner-ring: var(--_hudi-orb-light-ring);
  --_hudi-orb-glow-strength: var(--hudi-orb-glow-strength, 50%);
  --_hudi-orb-glow-radius: var(--hudi-orb-glow-radius, clamp(4px, calc(var(--_hudi-orb-size) * .055), 24px));
  position: relative;
  display: grid;
  place-items: center;
  width: var(--_hudi-orb-size);
  aspect-ratio: 1;
  border-radius: 50%;
  background-color: var(--_hudi-orb-base);
  background-image: linear-gradient(180deg, var(--_hudi-orb-sheen) 0%, rgba(255, 255, 255, 0) 100%);
  box-shadow:
    inset 0 calc(var(--_hudi-orb-size) * -.061625) calc(var(--_hudi-orb-size) * .643984) var(--_hudi-orb-shadow),
    inset 0 0 calc(var(--_hudi-orb-size) * .09) color-mix(in srgb, var(--_hudi-orb-sheen) 58%, transparent);
  overflow: hidden;
  transition: filter 160ms ease;
}

.hudi-orb[data-orb-theme="dark"],
[data-theme="dark"] .hudi-orb[data-orb-theme="inherit"] {
  --_hudi-orb-outer-ring: var(--_hudi-orb-light-ring);
  --_hudi-orb-inner-ring: var(--_hudi-orb-dark-ring);
}

.hudi-orb[data-orb-theme="dark"][data-orb-glow="true"],
[data-theme="dark"] .hudi-orb[data-orb-theme="inherit"][data-orb-glow="true"] {
  filter: drop-shadow(0 0 var(--_hudi-orb-glow-radius) color-mix(in srgb, var(--_hudi-orb-base) var(--_hudi-orb-glow-strength), transparent));
}

.hudi-orb__rings {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  box-shadow:
    inset 0 0 0 var(--_hudi-orb-ring-width) var(--_hudi-orb-outer-ring),
    inset 0 0 0 var(--_hudi-orb-ring-depth) var(--_hudi-orb-inner-ring);
  pointer-events: none;
}

.hudi-orb::before {
  position: absolute;
  left: 18.6%;
  top: 3.8%;
  z-index: 1;
  width: 64%;
  height: 46%;
  border-radius: 50%;
  background: linear-gradient(359.42deg, rgba(255, 255, 255, 0) .5%, #fff 99.5%);
  content: "";
}

.hudi-orb::after {
  position: absolute;
  left: 32.05%;
  top: 1.1%;
  z-index: 1;
  width: 36.34%;
  height: 18.06%;
  border-radius: 50%;
  background: radial-gradient(51.58% 50% at 50% 50%, #fff 0%, rgba(255, 255, 255, .14) 100%);
  content: "";
}

/* Restored Figma Ellipse 327: lower transmitted-light effect. */
.hudi-orb__bottom-highlight {
  position: absolute;
  left: 27.78%;
  right: 26.83%;
  top: 51.39%;
  bottom: 3.22%;
  z-index: 3;
  border-radius: 50%;
  background: radial-gradient(
    50% 50% at 50% 50%,
    rgba(255, 255, 255, var(--hudi-orb-bottom-alpha, .84)) 0%,
    rgba(255, 255, 255, 0) 100%
  );
  mix-blend-mode: var(--hudi-orb-bottom-blend, overlay);
  pointer-events: none;
}

/* Keep the component circular inside flex and grid layouts. */
.hudi-orb {
  flex: none;
  isolation: isolate;
}

.hudi-orb::before,
.hudi-orb::after {
  pointer-events: none;
}

/* Optional transparent logo, painted beneath the glass highlights. */
.hudi-orb__logo {
  position: absolute;
  left: 50%;
  top: calc(50% + var(--hudi-orb-logo-offset-y, 0%));
  z-index: 0;
  display: block;
  width: calc(clamp(.36, var(--hudi-orb-logo-scale, .58), .72) * 100%);
  height: calc(clamp(.36, var(--hudi-orb-logo-scale, .58), .72) * 100%);
  object-fit: contain;
  object-position: center;
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.hudi-orb[data-logo-treatment="light"] .hudi-orb__logo {
  filter: brightness(0) invert(1);
}

.hudi-orb[data-logo-treatment="dark"] .hudi-orb__logo {
  filter: brightness(0) saturate(100%);
}

.hudi-orb.is-compact {
  --hudi-orb-ring-width: 2.75px;
  --hudi-orb-ring-depth: 5.5px;
}
```

## 3. Understand the layers before changing them

| Layer | Geometry / effect | Paint order |
| --- | --- | --- |
| Body | Solid base plus a 180° sheen-to-transparent gradient | Background |
| Depth | Inset shadow at −6.1625% vertical offset, 64.3984% blur; second inset glow at 9% blur | Above background |
| Optional logo | Centred, default box 58% of diameter | z-index: 0 |
| Broad reflection | Left 18.6%, top 3.8%, width 64%, height 46% | z-index: 1 |
| Bright cap | Left 32.05%, top 1.1%, width 36.34%, height 18.06% | z-index: 1, after broad reflection |
| Rim | Two concentric inset shadows; default width 0.6% and total depth 1.2% of diameter | z-index: 2 |
| Bottom radial highlight | Left 27.78%, right 26.83%, top 51.39%, bottom 3.22%; white `.84` to transparent, overlay blend | z-index: 3 |

The two upper reflections are ellipses with `border-radius: 50%`. The body clips them with `overflow: hidden`. The logo sits under the reflections so it appears embedded in the material. Do not move the reflections behind the logo or replace the broad reflection with an outer glow.

The bottom highlight is essential to this restored clear-glass treatment. Its box is 45.39% of the orb’s width and height, centred at approximately 50.475% horizontally and 74.085% vertically. Keep the slight horizontal asymmetry from the reference. The gradient fades completely to transparent at the ellipse boundary; do not add a solid fill, border, or extra blur.

`mix-blend-mode: overlay` lifts the underlying colour rather than laying an opaque white spot on top. The parent’s `isolation: isolate` keeps that blend within the orb. It creates an optical impression of clarity, not actual background transparency. Start with the reference’s `.84` centre alpha and overlay blend; use the calibration procedure below if the rendered result differs. This layer is painted last, as in the supplied Figma stack, and can also illuminate the lower portion of a logo.

## 4. Configure size and colour

Set the public CSS properties on each orb. All material geometry scales from the diameter.

```html
<div
  class="hudi-orb"
  data-orb-theme="light"
  data-orb-glow="false"
  role="img"
  aria-label="Glossy yellow orb"
  style="
    --hudi-orb-size: 136px;
    --hudi-orb-base: #fade4b;
    --hudi-orb-sheen: #fdf18b;
    --hudi-orb-shadow: rgba(239, 139, 52, .34);
  "
>
  <span class="hudi-orb__rings" aria-hidden="true"></span>
      <span class="hudi-orb__bottom-highlight" aria-hidden="true"></span>
</div>
```

Use a saturated base, a lighter related sheen, and a darker chromatic shadow. Supply all three for deliberate colour changes. A solid opaque shadow makes the result too heavy; the runtime uses shadow alpha `.34`, while the copied default pink CSS uses `.4`.

| Property | Default / use |
| --- | --- |
| `--hudi-orb-size` | `460px`; set explicitly for your layout |
| `--hudi-orb-base` | `#ec009e` |
| `--hudi-orb-sheen` | `#ff7dec` |
| `--hudi-orb-shadow` | `rgba(134, 0, 98, .4)` |
| `--hudi-orb-ring-width` | Diameter × `.006` |
| `--hudi-orb-ring-depth` | Ring width × `2`; total inset depth, not an additional width |
| `--hudi-orb-dark-ring` | Optional explicit override of the derived dark rim colour |
| `--hudi-orb-light-ring` | Optional explicit override of the derived light rim colour |
| `--hudi-orb-glow-strength` | `50%` |
| `--hudi-orb-glow-radius` | Diameter × `.055`, clamped to `4px`–`24px` |
| `--hudi-orb-logo-scale` | `.58`; a fraction of the orb diameter |
| `--hudi-orb-logo-offset-y` | `0%`; positive moves the mark downward |

For responsive sizing, use a length such as `--hudi-orb-size: clamp(64px, 20vw, 240px)`. Prefer a definite length or a clamp of lengths over a percentage because the same variable also drives shadow lengths.

Add `is-compact` only if you want the source's heavier compact rim: `2.75px` outer width and `5.5px` total depth. It is an explicit variant, not an automatic breakpoint. Review it at the intended size; proportional default rings are often preferable for very small orbs.

## 5. Set the theme

On a light surface use `data-orb-theme="light"`: dark outer rim, light inner rim. On a dark surface use `data-orb-theme="dark"`: light outer rim, dark inner rim. Set `data-orb-glow="true"` to enable a restrained coloured drop shadow in dark mode.

Alternatively, use `data-orb-theme="inherit"` and place the orb inside an ancestor with `data-theme="dark"`. The CSS does not detect the operating system theme or change the page background. Your application owns those decisions.

Give the surrounding layout enough room for the glow and avoid an ancestor that clips it.

## 6. Add an optional company logo

Insert this inside the orb, alongside the rings span, and update the orb's accessible label to the company name:

```html
<img
  class="hudi-orb__logo"
  src="./company-mark.png"
  alt=""
  draggable="false"
>
```

Use a supplied transparent PNG or SVG with tightly cropped artwork. Preserve aspect ratio with `object-fit: contain`. Start at a `.58` logo scale; aim for the visible standalone mark to occupy roughly 52% of the orb diameter, adjusting for transparent padding. The CSS clamps the logo box to `.36`–`.72`. Keep optical vertical corrections within `-12%` to `12%`, and start at `0%`.

Leave the image unfiltered for a multicolour brand mark. For a transparent single-colour mark, set `data-logo-treatment="light"` or `"dark"` on the orb to turn it white or black. Prefer white on medium/dark bodies and use black only on sufficiently bright bodies. Inspect the actual result under the highlight.

CSS colour filters do not remove an opaque white image background. Prepare a transparent asset first. This standalone recipe does not implement the source component's advanced SVG knockout or tonal filters, or its automatic monogram fallback. If your app loads images dynamically, implement an error fallback separately and never show a broken-image icon.

For a purely decorative orb, replace `role="img"` and `aria-label` with `aria-hidden="true"`. If it is clickable, place it inside a real button or link with an accessible name; the orb itself is not a control.

## Match the Figma appearance in a browser

Do not assume matching the blend-mode name guarantees a pixel match. CSS and Figma describe the same overlay operation, but the backdrop colours, opacity, grouping, colour profile, and rendering all affect the result. There is no verified universal “Figma-to-CSS opacity” correction. The settings below expose tuning; they have not been visually calibrated against a Figma render.

First match the inputs before compensating:

1. Export the complete reference orb from Figma as an sRGB PNG and compare it with the browser at the same displayed size and on the same background. The supplied example is 36px tall. Do not compare a magnified Figma canvas with a 36px browser orb.
2. Use the same base, sheen, and shadow. For the supplied orange reference, set `--hudi-orb-base: #ff8005`, `--hudi-orb-sheen: #ff7b22`, and `--hudi-orb-shadow: rgba(172, 53, 8, .4)`. The default pink recipe is not a colour match to that reference.
3. Keep `isolation: isolate` on the orb and the bottom highlight above the logo, as in the supplied stack. Verify that no additional parent/group opacity or filters alter the reference or implementation. The blend must see the sphere and logo beneath it.
4. Start with `--hudi-orb-bottom-blend: overlay` and `--hudi-orb-bottom-alpha: .84`. Adjust only the alpha first while comparing the lower highlight. Record any tuned value per palette rather than changing every orb by guesswork.
5. If the desired art direction is a paler, clearer glow that overlay cannot produce, try `screen` with a lower alpha, for example `.20`, then tune visually. This is an intentional approximation, not an equivalent conversion of Figma overlay. Avoid claiming a match until compared against the rendered reference.

```css
/* Reference settings; these are already the defaults. */
.orb-reference {
  --hudi-orb-bottom-blend: overlay;
  --hudi-orb-bottom-alpha: .84;
}

/* Optional art-directed alternative. Starting values, NOT a verified match. */
.orb-clearer {
  --hudi-orb-bottom-blend: screen;
  --hudi-orb-bottom-alpha: .20;
}
```

Add either class alongside `hudi-orb`. Do not apply both. Keep the ellipse geometry unchanged while tuning the blend so you can tell which change improved the match.

White overlay brightens channels according to their existing intensity; very dark channels receive little lift. White screen lifts those dark channels too, so it can look milkier and less saturated. This explains why replacing overlay with screen can change the material significantly, rather than simply strengthen it.

The copied base material also differs slightly from the supplied Figma upper-highlight stops and rim geometry. When exact fidelity is required, reconcile those inputs too; do not compensate for every difference by increasing the bottom highlight. CSS pasted from Figma alone is insufficient to verify a final visual match.

References: [W3C compositing and blending](https://www.w3.org/TR/compositing-1/), [Figma blend modes](https://help.figma.com/hc/en-us/articles/360040667874-Apply-blend-modes-to-layers-fills-and-effects), [Figma colour profiles](https://help.figma.com/hc/en-us/articles/360039825114-Manage-color-profiles-in-design-files).

## 7. Verify the implementation

- Open the page and inspect orbs at 48px, 136px, and 460px on light and dark surfaces.
- Confirm each orb remains a circle inside its actual flex/grid layout.
- Confirm the broad upper reflection and smaller bright cap are distinct, with no rectangular corners.
- Confirm a soft lower highlight is visible around 74% of the diameter from the top, fades without a hard edge, and retains the body colour.
- Confirm the double rim stays inside the circle and switches order in dark mode.
- Confirm the glow appears only with dark theme plus `data-orb-glow="true"`.
- If using a logo, verify centring, legibility, transparent edges, and containment beneath the reflections.
- Check the target browser supports the `color-mix()` calls used here; provide precomputed equivalent colours if supporting a browser that does not.

Deliver the reusable component or HTML/CSS, a small preview showing size and theme variants, and a short explanation of the public properties. Preserve the visual recipe above when integrating it into the host application.
