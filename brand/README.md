# Your Move — brand

Everything here is the source of truth for the mark. Take what you need from
`svg/` when a vector will do, and from `png/` when it will not.

## What the mark means

Two diamonds: the same form in its two states, one empty and one filled. The
board already speaks this language — `◇` is someone waiting on you, `◆` is you
having answered — so the mark is that pair caught mid-turn. The diagonal seam
between them is the only thing the product actually tracks: the boundary between
their side and yours, and which side the piece is currently on.

Nothing about it depends on colour. Strip the palette and the empty form and the
filled one still say which is which.

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

> [!IMPORTANT]
> **The hollow diamond has no `fill-rule="evenodd"`, and must not be given one.**
> Its inner contour is wound anticlockwise against a clockwise outer, so the hole
> is correct under both `nonzero` and `evenodd`. This matters because a renderer
> that silently drops attributes — ImageMagick's SVG fallback is the usual
> culprit, and it exits 0 while doing it — would produce a _solid_ diamond where
> a hollow one belongs. Half the mark's meaning, gone, with nothing to show for
> it in the output. Rasterise with `rsvg-convert`, and look at the result.

> [!NOTE]
> **No strokes anywhere.** Every form is a filled path, so the mark scales
> without a stroke width to keep in step, and no renderer has to agree with us
> about how a hairline should behave.

## Known limits

- **16px is too small.** It holds cleanly at 32px and above. Below that the
  hollow counterform closes up — true of any mark built on one, and not fixable
  without abandoning the idea.
- **The lockup's lettering is outlined**, not live text. Charter Bold, the freely
  redistributable serif in the app's own `--font-serif` stack, with the font's
  own kerning applied and −24/1000 em tracking. There is no font dependency and
  nothing to install; there is also nothing to re-typeset, so a wording change
  means going back to the source.
- **Two lockup files rather than one self-adapting one.** GitHub strips `<style>`
  from SVG, so a single file switching on `prefers-color-scheme` renders wrong
  there. Wrap them in `<picture>` where both are available.
