# Your Move — brand

> **GITHUB MOVES. YOUR TURN.**

Four words that say the product better than any sentence written for it. Use it
wherever the name alone is not enough — the README, the OAuth App page, a store
listing. Small caps, wide tracking.

## The mark

A folded **M**: two interlocking forms, one rose and one ivory, with a
forward-pointing play triangle cut into the fold. The two halves are **your
move** and **their move**, and the fold between them is the handover — which is
the only thing this app is about.

![Your Move handover identity](handover/preview.png)

It is the mark the app ships. `public/icons/` and `assets/` are rendered from
the files below, not from anything else in this folder.

## Which file to use where

| Use                                                       | File                                   |
| --------------------------------------------------------- | -------------------------------------- |
| GitHub OAuth App, store listings, anything wanting raster | `handover/png/icon-1024.png`           |
| App icon, favicon, anything square                        | `handover/svg/icon.svg`                |
| Android home screen, adaptive icons                       | `handover/svg/icon-maskable.svg`       |
| A light ground                                            | `handover/svg/icon-light.svg`          |
| Wordmark lockup, dark / light / one colour                | `handover/svg/logo{,-light,-mono}.svg` |
| Mark alone on transparency                                | `handover/svg/mark{,-light,-mono}.svg` |

The full file table, the geometry and the regeneration commands are in
[`handover/README.md`](handover/README.md). PNGs are generated — never edit one.

## Colours

| Token            | Dark      | Light     |
| ---------------- | --------- | --------- |
| Ground           | `#0b0c0e` | `#f4f2f0` |
| Mark, ivory form | `#e9ebee` | `#1a1c1f` |
| Mark, rose form  | `#e0707c` | `#b03a4c` |

Exactly the app's own tokens. The accent is re-derived rather than reused on
light: `#e0707c` is calibrated against near-black, where it reads about 7:1, and
falls under 3:1 on white.

> [!IMPORTANT]
> **No strokes, no fonts, no embedded raster anywhere.** Every form is a filled
> path and the wordmark is outlined, so the mark scales without a stroke width to
> keep in step, and nothing depends on a font being installed where it is
> rendered. Rasterise with `rsvg-convert` or Inkscape and **look at the result** —
> ImageMagick's SVG fallback drops path attributes while exiting 0, so a broken
> render has nothing in the output to say so.

## Superseded

[`superseded/`](superseded/) holds the ring-and-half-disc "C" the app carried
until this mark replaced it — inherited from
[`kud/companies`](https://github.com/kud/companies), where it was drawn as a
"co" monogram. Nothing uses it. It is kept as a record rather than an option;
take a file from `handover/` above.
