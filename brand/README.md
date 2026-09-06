# Your Move — brand

Everything here is the source of truth for the mark. Take what you need from
`svg/` when a vector will do, and from `png/` when it will not.

## What the mark means

One circle, twice: once open and once whole, parted by a single straight cut.
The open one is the side that has let it go; the full one is the side that holds
it. The cut is the only thing this app actually tracks — which side of it the
piece is currently on.

An empty circle beside a full one needs no reference to trace, which is the
point: provenance you have to look up is not provenance.

## Which file to use where

| Use                                                       | File                                           |
| --------------------------------------------------------- | ---------------------------------------------- |
| App icon, favicon, anything square                        | `svg/icon.svg`                                 |
| Android home screen, adaptive icons                       | `svg/icon-maskable.svg`                        |
| One-colour contexts, Safari `mask-icon`                   | `svg/icon-mono.svg`                            |
| README, OAuth App page, anywhere with room for the name   | `svg/lockup-dark.svg` · `svg/lockup-light.svg` |
| GitHub OAuth App, store listings, anything wanting raster | `png/icon-1024.png`                            |

`png/` is generated from `svg/` — never edit a PNG. Regenerate with:

```bash
rsvg-convert -w 1024 -h 1024 brand/svg/icon.svg -o brand/png/icon-1024.png
```

## Colours

| Token             | Dark      | Light     |
| ----------------- | --------- | --------- |
| Ground            | `#0b0c0e` | `#f4f2f0` |
| Mark, hollow form | `#e9ebee` | `#1a1c1f` |
| Mark, filled form | `#e0707c` | `#b03a4c` |

The accent is re-derived rather than reused on light: `#e0707c` is calibrated
against near-black, where it reads about 7:1, and falls under 3:1 on white.

> [!NOTE]
> **Every path is a single closed contour** — no compound paths, no holes. The
> arc is outer-arc, line, inner-arc, close. That is deliberate: a hole depends on
> `fill-rule` and winding order, which is exactly the sort of thing a fallback
> SVG renderer drops while exiting 0 — turning a hollow form solid with nothing
> in the output to say so. There is no hole here to lose.
>
> **No strokes anywhere either.** Every form is a filled path, so the mark scales
> without a stroke width to keep in step, and no renderer has to agree with us
> about how a hairline should behave.

## Known limits

- **16px is too small.** It holds at 32px and above — verified by rendering it,
  not asserted. Below that the arc's aperture closes up.
- **The maskable variant sits at 0.82, not the usual 0.88.** This composition is
  taller than it is wide, so its corner radius grows faster and 0.88 overshot the
  safe circle. Verified by rendering the file under an actual circular crop
  rather than by trusting the arithmetic.
- **The lockup's lettering is outlined**, not live text. Charter Bold, the freely
  redistributable serif in the app's own `--font-serif` stack, with the font's
  own kerning applied and −24/1000 em tracking. There is no font dependency and
  nothing to install; there is also nothing to re-typeset, so a wording change
  means going back to the source.
- **Two lockup files rather than one self-adapting one.** GitHub strips `<style>`
  from SVG, so a single file switching on `prefers-color-scheme` renders wrong
  there. Wrap them in `<picture>` where both are available.
