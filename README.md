# Ronald Jefferson — Photography

A three-page cinematic photography portfolio. Plain HTML, CSS and JavaScript —
no build step, no framework, no dependencies. Open `index.html`, or serve the
folder over any static host.

```
index.html
css/style.css
js/data.js      generated asset manifest (see "Adding photographs")
js/main.js
images/         originals, used for the lightbox
images/thumb/   900px derivatives, used everywhere else
```

## The three pages

**About** is one continuous sequence rather than a stack of sections. The name
is built in depth — contact-sheet cards sit both behind and in front of the
type. Scrolling then moves through a pinned statement that opens through a
widening aperture, an annotated portrait whose stroke draws itself, a marquee
tied to scroll velocity, and an index of disciplines that hands off to the roll.

**Work** is a 35mm roll laid on its side. Page scroll is the single source of
truth for its position, so the wheel, dragging, swiping, the arrow keys and the
ticker can never disagree with each other. Opening the centre frame unspools
that category into a vertical reel; clicking a photograph grows it into the
lightbox and shrinks it back to the same spot on close.

**Contact** closes the sequence with large type, magnetic rows and a final
call to action.

## Design notes

The ground is a warm, slightly green-shifted black — unexposed film base. The
only saturated colour in the interface is a lichen olive; amber appears
exclusively as *light* (leaks, glows, the wash behind a frame) and never as a
fill, so it can't compete with the photographs. Display type is Fraunces at
high optical size, metadata is Inter, and film edge codes are set in a system
monospace, which is what such codes are actually printed in.

Typefaces load from Google Fonts. The fallback stack is Iowan Old Style /
Georgia, so the page still reads properly if that request fails.

## Adding or changing photographs

Drop files into `images/<category>/` and regenerate the manifest — the site
reads categories, counts, covers and real pixel dimensions from `js/data.js`,
and nothing is hardcoded in the markup.

```bash
python3 tools/build-manifest.py
```

The manifest carries each image's true width and height, which is what lets the
reel lay out by real aspect ratio without any layout shift. Covers are chosen
automatically, favouring a mid-bright, roughly 3:2 frame; override one by
editing its `cover` field.

## Performance

The first screen loads one photograph. The eight roll covers are warmed once
the visitor scrolls past the hero rather than lazily, because a 3D-transformed
element reports its intersection late and the centre frame could otherwise
arrive blank. Everything else is lazy-loaded 700px ahead. Full-resolution files
are fetched only by the lightbox. All scroll-linked work runs in a single
`requestAnimationFrame` loop and animates transform and opacity only.

## Accessibility

Semantic landmarks, a skip link, visible focus rings, alt text on every
photograph, and full keyboard control: arrow keys and Home/End move the roll,
Enter opens a reel, Escape steps back out one level at a time.

`prefers-reduced-motion` is treated as a real request rather than a slower
version of the same thing. Parallax, the marquee, the drifting cards, the
scroll cue and the roll's 3D depth are all switched off; the aperture is simply
open, and every element is present rather than waiting to be revealed.
