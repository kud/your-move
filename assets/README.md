# Icon sources

The SVGs here are the originals; everything under `../public/icons/` is rendered
from them and committed alongside, because a build that shells out to
ImageMagick would only work on a laptop that happens to have it.

`icon.svg` is the plain mark. `icon-maskable.svg` is the same mark recomposed
inside the centre 80% with its ground bled to all four edges — Android crops a
maskable icon to whatever shape the launcher prefers, and a plain icon declared
maskable gets its mark shaved off.

> [!IMPORTANT]
> Keep both files to filled paths only — no `stroke`, no gradient, no `<mask>`.
> Without `rsvg-convert` on the box, ImageMagick falls back to its own renderer,
> which drops all three **and still exits 0**, so a stroked mark becomes a blank
> square with nothing to point at. Arcs and plain fills survive, which is why
> the `c` is drawn as a compound path rather than a thick-stroked ring.

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
transparent home-screen icon is composited onto white:

```sh
magick -background '#0b0c0e' assets/icon.svg -flatten -resize 180x180 -depth 8 -strip public/icons/apple-touch-icon.png
```
