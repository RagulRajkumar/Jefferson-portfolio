# Ronald Jefferson — Photographer

A single-page photography portfolio. Plain HTML, CSS and JavaScript — no build
step, no framework, no dependencies. Photographs are served **in place, at full
resolution** from `portfolio-images/`; nothing is resized, re-encoded or copied.

```
index.html                  the page
assets/style.css            styles
assets/main.js              reel, album view, lightbox, routing
assets/manifest.js          generated — albums, covers, captions, sizes, colours
assets/build-manifest.py    generates manifest.js from portfolio-images/
portfolio-images/           the photographs, one folder per album (+ Profile photo)
```

Everything else in this folder (`Jeff/`, `site/`, `site.zip`,
`Portfolio Website/`, `Ronald Jefferson Portfolio.html`) is an older version and
is not used by this site.

## Run it locally

Open `index.html` directly, or serve the folder:

```bash
cd path/to/this/folder
python3 -m http.server 8000        # then open http://localhost:8000/
```

## The page

- **Reel** — the albums as a horizontal 3D reel. The album title sits centred on
  its cover; the centre frame is full colour, its neighbours dimmed. It autoplays
  gently, and reacts to drag, swipe, trackpad swipe, ← → keys and the album
  ticker. Clicking the centre frame zooms the cover into the album view.
- **Album view** — the cover as a banner with the title centred on it, then every
  photograph in justified rows at its true aspect ratio (nothing cropped). Rows
  are laid out from the pixel sizes in the manifest, so there is no layout shift.
- **Lightbox** — full-resolution original, ← → keys, swipe, Esc.
- **About / Selected frames / Contact** below the reel.
- Routes are shareable: `#/wildlife` opens an album, `#/wildlife/2` a photograph.

## Adding or changing photographs

1. Drop files into the album folder inside `portfolio-images/` (jpg, png, webp).
2. Optionally set their order, a caption fix or a new cover in
   `assets/build-manifest.py` (`ALBUMS` → `order`, `cover`, `coverM`; `CAPTIONS`).
   Anything not listed is appended alphabetically and captioned from its filename.
3. Re-run the generator (needs Python 3 with Pillow):

```bash
python3 assets/build-manifest.py
```

Covers: `cover` is used on desktop (3:2 frame), `coverM` on phones (4:5 frame).
The two numbers after a cover are its focal point in percent (like CSS
`object-position`), so the crop keeps the subject where you want it.

## Before deploying

- Upload `index.html`, `assets/` and `portfolio-images/` together.
- Folder names must match `assets/manifest.js` exactly. In the shared zip the
  album folders have plain names. In the original working folder on the Mac four
  of them end with a trailing space (`Wedding Photography `, `Sports photography `,
  `Painting Recreation `, `Profile photo `), which Windows and some hosts
  mishandle; if you work from that folder, rename them and re-run the generator:

```bash
cd portfolio-images
for d in */; do n="${d%/}"; t="$(echo "$n" | sed 's/[[:space:]]*$//')"; [ "$n" != "$t" ] && mv "$n" "$t"; done
cd .. && python3 assets/build-manifest.py
```

- The photographs total ~1.5 GB (164 files, 0.1–36 MB each). The site loads
  them lazily and shows each photograph's average colour while it arrives, but a
  30 MB original still takes several seconds on an average connection. That is
  the cost of serving originals; if it ever matters, generating web-size copies
  is a one-line change in the generator, not a redesign.
- Rendering: browsers re-decode an image every time it scrolls back into view,
  and decoding a 50-megapixel JPEG takes hundreds of milliseconds, which made the
  reel stutter. So covers, grid frames and the selected frames are each drawn
  once into a canvas at screen resolution and never decoded again. The files are
  untouched and the lightbox always shows the original.
- Contact details in `index.html` (email, phone, Instagram `@DSC16042002`) were carried
  over from the earlier build — confirm them with Ronald before going live.
