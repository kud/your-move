# Your Move — brand

Everything here is the source of truth for the mark. Take what you need from
`svg/` when a vector will do, and from `png/` when it will not.

## What the mark means

A thick open ring with a half-disc resting in its mouth — one form that has let
go, one that is held.

> [!NOTE]
> **This mark is shared with [`kud/companies`](https://github.com/kud/companies),
> which still uses it at board.kud.io.** That is a deliberate choice rather than
> an oversight: it was kept because it was preferred, after two alternatives were
> designed and rejected. Both products are Erwann's, so nothing is being
> borrowed — but they do read as one family, and the ring resolves as a "C",
> which belonged to the other name. Worth knowing before it goes anywhere public.

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

- **16px is marginal.** The ring's aperture is generous enough to survive
  better than the alternatives did, but check it where you use it.
- **The maskable variant is the same composition at 0.86**, with the ground
  bled to the edges. The original was never drawn for a launcher crop, so this
  is derived rather than copied — and verified by rendering it under an actual
  circular crop rather than by trusting the arithmetic.
- **There is no wordmark lockup.** The two that existed were drawn for a mark
  that is no longer used. Ask for one when something needs it.
