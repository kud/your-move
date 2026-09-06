# Your Move — brand

> **GITHUB MOVES. YOUR TURN.**

Four words that say the product better than any sentence written for it. Use it
wherever the name alone is not enough — the README, the OAuth App page, a store
listing. Small caps, wide tracking.

Everything here is the source of truth for the mark. Take what you need from
`svg/` when a vector will do, and from `png/` when it will not.

## What the mark means

A thick open ring with a half-disc resting in its mouth — one form that has let
go, one that is held.

> [!NOTE]
> **This mark was inherited from [`kud/companies`](https://github.com/kud/companies)**,
> where it was drawn as a "co" monogram. That project's deployment has since been
> retired, so nothing else uses it and nothing is being shared — but the ring
> still resolves as a "C", which is where it came from rather than what it means.
> It was kept because it was preferred, after three alternatives were designed
> and compared side by side at 32px and in monochrome.

## Which file to use where

| Use                                                       | File                                           |
| --------------------------------------------------------- | ---------------------------------------------- |
| App icon, favicon, anything square                        | `svg/icon.svg`                                 |
| Android home screen, adaptive icons                       | `svg/icon-maskable.svg`                        |
| One-colour contexts, Safari `mask-icon`                   | `svg/icon-mono.svg`                            |
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
> **The ring is a compound path and its hole depends on winding order.** The
> inner arc is wound against the outer, so the counterform is correct under both
> `nonzero` and `evenodd` — but a renderer that drops path attributes while
> exiting 0 (ImageMagick's SVG fallback is the usual culprit) would fill it in,
> and the failure is a solid blob where a ring belongs, with nothing in the
> output to say so. Rasterise with `rsvg-convert`, and look at the result.
>
> **No strokes anywhere.** Every form is a filled path, so the mark scales
> without a stroke width to keep in step, and no renderer has to agree with us
> about how a hairline should behave.

## Known limits

- **In one colour the two forms merge.** The ring and the half-disc read as a
  single letter rather than as one thing held and one let go — verified by
  rendering `icon-mono.svg` at 32px, not assumed. The mark stays legible; it is
  the *meaning* that thins. Worth knowing before using the mono variant anywhere
  the distinction is the point.

- **16px is marginal.** The ring's aperture is generous enough to survive
  better than the alternatives did, but check it where you use it.
- **The maskable variant is the same composition at 0.86**, with the ground
  bled to the edges. The original was never drawn for a launcher crop, so this
  is derived rather than copied — and verified by rendering it under an actual
  circular crop rather than by trusting the arithmetic.
- **There is no wordmark lockup.** The two that existed were drawn for a mark
  that is no longer used. Ask for one when something needs it.
