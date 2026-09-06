# Your Move — brand

> **GITHUB MOVES. YOUR TURN.**

Four words that say the product better than any sentence written for it. Use it
wherever the name alone is not enough — the README, the OAuth App page, a store
listing. Small caps, wide tracking.

![Your Move logo, monochrome mark and light icon](preview.png)

## The mark

A folded **M**: two interlocking forms, one rose and one ivory, with a
forward-pointing play triangle cut into the fold. The two halves are **your
move** and **their move**, and the fold between them is the handover — which is
the only thing this app is about.

It is drawn as clean Bézier paths, and the lettering is converted to outlines,
so nothing here needs a font installed where it is rendered. This is the mark
the app ships: `public/icons/` and `assets/` are rendered from `svg/` below.

## Files

| Use                                 | SVG source                                       | PNG export                                               |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------------------------- |
| GitHub OAuth App, store listings    | [`svg/icon.svg`](svg/icon.svg)                   | [`png/icon-1024.png`](png/icon-1024.png)                 |
| Symbol on dark backgrounds          | [`svg/mark.svg`](svg/mark.svg)                   | [`png/mark-1200.png`](png/mark-1200.png)                 |
| Symbol on light backgrounds         | [`svg/mark-light.svg`](svg/mark-light.svg)       | [`png/mark-light-1200.png`](png/mark-light-1200.png)     |
| One-colour symbol                   | [`svg/mark-mono.svg`](svg/mark-mono.svg)         | [`png/mark-mono-1200.png`](png/mark-mono-1200.png)       |
| Symbol and wordmark, dark           | [`svg/logo.svg`](svg/logo.svg)                   | [`png/logo-2880.png`](png/logo-2880.png)                 |
| Symbol and wordmark, light          | [`svg/logo-light.svg`](svg/logo-light.svg)       | [`png/logo-light-2880.png`](png/logo-light-2880.png)     |
| Symbol and wordmark, one colour     | [`svg/logo-mono.svg`](svg/logo-mono.svg)         | [`png/logo-mono-2880.png`](png/logo-mono-2880.png)       |
| App icon, favicon, anything square  | [`svg/icon.svg`](svg/icon.svg)                   | `png/icon-{16,32,180,192,512,1024}.png`                  |
| App icon on a light ground          | [`svg/icon-light.svg`](svg/icon-light.svg)       | [`png/icon-light-512.png`](png/icon-light-512.png)       |
| Android home screen, adaptive icons | [`svg/icon-maskable.svg`](svg/icon-maskable.svg) | [`png/icon-maskable-512.png`](png/icon-maskable-512.png) |

`mark*` and `logo*` have transparent backgrounds; the mono variants are ivory,
so recolour their path fills for other single-ink uses. The `icon*` variants are
opaque and square, and leave launcher rounding to the operating system — which
is what the iOS home-screen icon requires, since a transparent one is
composited onto white. The maskable variant keeps the whole mark inside the
central safe circle of radius 40% of the canvas.

Default to the dark palette; on a light ground use the `-light` files so the
ivory half stays visible. The number in a filename is the PNG width — marks are
1200 × 1056, lockups 2880 × 704.

## Colours

| Element                      | Dark      | Light     |
| ---------------------------- | --------- | --------- |
| Accent form                  | `#e0707c` | `#b03a4c` |
| Companion form and lettering | `#e9ebee` | `#1a1c1f` |
| App-icon ground              | `#0b0c0e` | `#f4f2f0` |

Exactly the app's own tokens. The accent is re-derived rather than reused on
light: `#e0707c` is calibrated against near-black, where it reads about 7:1, and
falls under 3:1 on white.

> [!IMPORTANT]
> **No strokes, no fonts, no embedded raster anywhere.** Every form is a filled
> path and the wordmark is outlined, so the mark scales without a stroke width to
> keep in step, and nothing depends on a font being installed where it is
> rendered. Keep it that way: without `rsvg-convert` on the box, ImageMagick
> falls back to its own renderer, which drops strokes, gradients and text **and
> still exits 0** — so a broken render has nothing in the output to say so.
> Rasterise, then look at the result.

## Regenerate the PNGs

Never edit a PNG. From the repository root, with Inkscape installed:

```sh
for name in mark mark-light mark-mono; do
  inkscape "brand/svg/$name.svg" --export-type=png \
    --export-width=1200 --export-filename="brand/png/$name-1200.png"
done
```

```sh
for name in logo logo-light logo-mono; do
  inkscape "brand/svg/$name.svg" --export-type=png \
    --export-width=2880 --export-filename="brand/png/$name-2880.png"
done
```

```sh
for size in 16 32 180 192 512 1024; do
  inkscape brand/svg/icon.svg --export-type=png \
    --export-width="$size" --export-filename="brand/png/icon-$size.png"
done
```

```sh
for name in icon-light icon-maskable; do
  inkscape "brand/svg/$name.svg" --export-type=png \
    --export-width=512 --export-filename="brand/png/$name-512.png"
done
```

Keep the emblem geometry consistent across the variants, and preserve the empty
channel between the two forms in mono — it is the only thing separating them
when the colour is gone. The 16px export keeps the silhouette; its inner detail
only resolves at 32px and above.

The app's own icons are a separate render, from the copies in
[`../assets/`](../assets/README.md) — edit here, copy there.
