# Icon sources

Copies of `../brand/handover/svg/`, kept here because everything under
`../public/icons/` is rendered from them and committed alongside — a build that
shelled out to ImageMagick would only work on a laptop that happens to have it.
**`brand/` is the original; edit there and copy here**, so the two cannot fork.

`icon.svg` is the folded **M** on its ground. `icon-maskable.svg` is the same
mark at 0.92 with the ground bled to all four edges — Android crops a maskable
icon to whatever shape the launcher prefers, and a plain icon declared maskable
gets its mark shaved off.

> [!IMPORTANT]
> Keep both files to filled paths only — no `stroke`, no gradient, no `<mask>`,
> no `<text>`. Without `rsvg-convert` on the box, ImageMagick falls back to its
> own renderer, which drops all of those **and still exits 0**, so a stroked mark
> becomes a blank square with nothing to point at. Verified: `magick` reproduces
> the current files to within 2% RMSE of the committed PNGs, because there is
> nothing in them for it to drop.

To regenerate after editing either file:

```sh
magick -background none assets/icon.svg -resize 192x192 -depth 8 -strip public/icons/icon-192.png
```

```sh
magick -background none assets/icon.svg -resize 512x512 -depth 8 -strip public/icons/icon-512.png
```

```sh
magick -background none assets/icon-maskable.svg -resize 512x512 -depth 8 -strip public/icons/icon-maskable-512.png
```

iOS reads this one rather than the manifest, and it must be opaque — a
transparent home-screen icon is composited onto white. The mark carries its own
`#0b0c0e` ground, so `-flatten` is belt and braces rather than load-bearing:

```sh
magick -background '#0b0c0e' assets/icon.svg -flatten -resize 180x180 -depth 8 -strip public/icons/apple-touch-icon.png
```
