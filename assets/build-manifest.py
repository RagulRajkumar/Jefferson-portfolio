#!/usr/bin/env python3
"""
Builds assets/manifest.js from the portfolio-images/ folder.

The site reads everything from the manifest: album order, covers, focal points,
photo order, captions, true pixel dimensions (zero layout shift) and each
photo's average colour (used as the placeholder while the original loads).
Photographs are referenced in place at full resolution — nothing is resized,
re-encoded or copied.

Re-run after adding, removing or renaming photographs:

    python3 assets/build-manifest.py
"""
import os, re, json, sys
from urllib.parse import quote
from PIL import Image, ImageOps

HERE      = os.path.dirname(os.path.abspath(__file__))
ROOT      = os.path.dirname(HERE)
IMG_DIR   = "portfolio-images"
IMG_ROOT  = os.path.join(ROOT, IMG_DIR)
OUT       = os.path.join(HERE, "manifest.js")
EXTS      = {".jpg", ".jpeg", ".png", ".webp"}

# ---------------------------------------------------------------------------
# Curation. `cover` is the desktop (3:2) cover, `coverM` the phone (4:5) cover;
# the two numbers are the focal point (object-position, %) used for cropping.
# `order` lists the strongest frames first; anything not listed follows,
# alphabetically. Folder names are matched case-insensitively and ignoring
# surrounding whitespace, so trailing spaces in the folder names are harmless.
# ---------------------------------------------------------------------------
ALBUMS = [
  dict(id="portrait", title="Portrait", dir="Portrait Photography",
       desc="Faces met on the road and in the studio — musicians, makers, brides, and the people who stop to talk.",
       cover=("Musicians_.jpg", 50, 50), coverM=("Festival dancer_.jpg", 50, 30),
       order=["Musicians_", "Manjanathi", "Festival dancer_", "Chai wale", "Tailor", "Grandma with Garland",
              "Grandpa with Garland_", "Toy maker", "Sunkissed portrait_", "Ruqqaiya Engagement_", "Ruqqaiya Sisters_",
              "Ruqqaiya Engagement 2", "Traditional dancer - Male", "Rockstar_", "Garment Vendor_", "Uncle 1",
              "Boy with Luggage_", "Couple pointing_"]),
  dict(id="landscape", title="Landscape", dir="Landscape Photography",
       desc="Udaipur’s lakes, the Thar, the Western Ghats — waiting for the light to do something.",
       cover=("Scenic stay_.jpg", 50, 50), coverM=("Scenic stay_.jpg", 42, 50),
       order=["Scenic stay_", "Thar Rajasthan", "Kadavul", "Floating park", "Jaisalmer_", "Mirjan fort , gokarna",
              "Lake city_", "Meharagarh fort", "Pykara Falls , ooty", "City palace", "Banks of Udaipur_", "Lake Udaipur 2",
              "Bridge Udaipur_", "Pink city Jaipur_", "Ghost Village_", "Port Kochi"]),
  dict(id="architecture", title="Architecture", dir="Architecture Photography",
       desc="Forts, palaces, stepwells and doorways across Rajasthan and Tamil Nadu.",
       cover=("Patrika Gate, Jaipur.jpg", 50, 50), coverM=("Patrika Gate, Jaipur.jpg", 50, 50),
       order=["Patrika Gate, Jaipur", "Hawah Mahal, Jaipur", "Amer Fort, Jaipur(1)", "Bada Bagh, Jaisalmer 2",
              "City Palace, Udaipur", "Gadisar Lake, Jaisalmer", "Ghost Town, Jaisalmer", "Mayuranathar Temple, Mayiladuthurai",
              "Darbar Hall, Meharangargh Fort", "Mehrangargh Fort, Jodhpur 2", "Door Frame", "Ghost Village, Jaisalmer",
              "Jal Mahal, Jaipur", "Amer Fort, Jaipur", "Meherangargh Fort, Jodhpur", "Bada Bagh 1", "City Palace, Udaipur 2",
              "Panna Meena ka Kund", "Wall Frame, Jaipur", "Wall, Jaisalmer", "Leela Palace, Udaipur"]),
  dict(id="wildlife", title="Wildlife", dir="Wildlife Photography",
       desc="Birds, big cats, and the occasional goat with a famous name.",
       cover=("Sun conure_.jpg", 50, 50), coverM=("King Of Good Times 1.jpg", 50, 50),
       order=["Sun conure_", "Durai Singam", "Cockatoo_", "Cheetah_", "King Of Good Times 1", "Deer and calf",
              "Lion tailed Monkey_", "Oh Butterfly", "Messi", "Lewis Hamilton", "IlayaMaan", "Kulla Nari", "Little Egret",
              "Black stork", "Tanimbar Corella", "Bird Nest_", "Bird pooping_", "King of Good Times 2", "Little Cormorant_",
              "Little Cormorant 2", "Red Naped Ibis", "Duck", "Meow", "Lizard_", "Grasshopper_", "IMG_20250417_163723",
              "TVK", "Crane", "camel"]),
  dict(id="fashion", title="Fashion", dir="Fashion Photography",
       desc="Studio editorials in hard light, gels and smoke.",
       cover=("Model Sitting (Male).jpg", 50, 22), coverM=("Model Sitting (Male).jpg", 50, 20),
       order=["Model Sitting (Male)", "Model Sitting_", "Model with Champagne Glass", "Model lying (Starlight)",
              "Model with Dhup", "Smoking Model Girl", "Women suite_", "Black Cat 1", "Black Cat 2", "Rockstar Model",
              "Smoking Model Boy", "Rider_", "Model Reading Book", "Model Lying on Steps"]),
  dict(id="wedding", title="Wedding", dir="Wedding Photography",
       desc="Four weddings, told from inside the room.",
       cover=("Adithiya - Sumitha 3.jpg", 50, 50), coverM=("Ruqqaiya - Arbaz 7.jpg", 50, 12),
       order=["Ruqqaiya - Arbaz 7", "Ruqqaiya - Arbaz 5", "Ruqqaiya - Arbaz 4", "Ruqqaiya - Arbaz 6", "Ruqqaiya - Arbaz 2",
              "Ruqqaiya - Arbaz 3", "Ruqqaiya - Arbaz 1", "Ruqqaiya - Arbaz 8", "Adithiya - Sumitha 3", "Adithiya - Sumitha 2",
              "Adithiya - Sumitha 1", "Santhi - Agoram 1", "Santhi - Agoram 2", "Santhi - Agoram 3", "Robin - Priya 1",
              "Robin - Priya 2"]),
  dict(id="event", title="Event", dir="Event Photography",
       desc="Stage, runway and graduation — colour under moving light.",
       cover=("kantara dance couple 1.jpg", 30, 50), coverM=("kathak.jpg", 50, 40),
       order=["kantara dance couple 1", "kathak", "Dancers", "mudra dancer", "Fashion walk", "Children with flowers_",
              "Ecole intuit 1", "Ecole intuit 2", "Ecole intuit 3", "Ecole intuit 4", "Ecole intuit 5", "Ecole intuit 6",
              "Ecole intuit 7"]),
  dict(id="sports", title="Sports", dir="Sports photography",
       desc="Turf under floodlights, and a women’s athletics meet.",
       cover=("Football - Turf 1.jpg", 50, 50), coverM=("Football - Turf 1.jpg", 50, 50),
       order=["Football - Turf 1", "Women with Javelin_", "Women Athelete Running_", "Women - Long jump_", "Women - shot put",
              "Women- Shotput 2", "Turf - Cricket_", "Turf 1", "Turf 2", "Turf 3", "Football"]),
  dict(id="food", title="Food", dir="Food Photography",
       desc="Chai, tikka, ramen and dessert — shot dark and close.",
       cover=("Chai.jpg", 50, 50), coverM=("Straberry Mojito_.jpg", 50, 40),
       order=["Chai", "Straberry Mojito_", "Chicken Tikka", "Ramen", "Popcorn_", "Cupcake", "Muffin_", "Crossaint_",
              "Straberry_", "Mysore Pak", "Chicken fry"]),
  dict(id="product", title="Product", dir="Product Photography",
       desc="Perfume, chocolate, skincare and drinks — styled and lit in the studio.",
       cover=("Bellavita_.jpg", 50, 50), coverM=("Monster_.jpg", 50, 45),
       order=["Bellavita_", "Monster_", "Moisturizer_", "Cadbury Borneville_", "Faber castles color pencil_",
              "Serenity Candle", "Bailies chocolate Whiskey_", "Ponds", "Jimmy_s cocktail_", "Starbucks_", "Zara perfume_",
              "Derma Sunscreen_", "Anand_s Mysorepak"]),
  dict(id="painting", title="Painting Recreation", dir="Painting Recreation",
       desc="A classical Indian painting restaged as a photograph, shown beside its reference.",
       cover=("Women With Sitar Painting Recreation.png", 50, 28), coverM=("Women With Sitar Painting Recreation.png", 50, 25),
       order=["Women With Sitar Painting Recreation", "Recreation of Women with Sitar"]),
]

PROFILE_DIR  = "Profile photo"
PROFILE_FILE = "Ronald Jefferson.jpg"

# Frames pulled onto the home page under "Selected frames": (album id, file stem)
SELECTED = [("landscape", "Thar Rajasthan"), ("portrait", "Festival dancer_"), ("wildlife", "Durai Singam"),
            ("wedding", "Ruqqaiya - Arbaz 5"), ("architecture", "Gadisar Lake, Jaisalmer"), ("product", "Monster_")]

# Caption overrides (file stem → caption). Spelling fixes and readable names;
# the photographer's own playful titles are kept.
CAPTIONS = {
  "Crossaint_": "Croissant", "Straberry_": "Strawberry", "Straberry Mojito_": "Strawberry mojito",
  "Faber castles color pencil_": "Faber-Castell colour pencils", "Hawah Mahal, Jaipur": "Hawa Mahal, Jaipur",
  "Meharagarh fort": "Mehrangarh Fort", "Meherangargh Fort, Jodhpur": "Mehrangarh Fort, Jodhpur",
  "Mehrangargh Fort, Jodhpur 2": "Mehrangarh Fort, Jodhpur · II", "Darbar Hall, Meharangargh Fort": "Darbar Hall, Mehrangarh Fort",
  "Bailies chocolate Whiskey_": "Baileys Chocolate", "Cadbury Borneville_": "Cadbury Bournville",
  "Women Athelete Running_": "Women’s 200m", "Women - Long jump_": "Women’s long jump", "Women - shot put": "Women’s shot put",
  "Women- Shotput 2": "Women’s shot put · II", "Women with Javelin_": "Javelin", "Football - Turf 1": "Football turf",
  "Turf - Cricket_": "Turf cricket", "Anand_s Mysorepak": "Anand’s Mysore Pak", "Jimmy_s cocktail_": "Jimmy’s Cocktails",
  "Women suite_": "The suit", "Amer Fort, Jaipur(1)": "Amer Fort, Jaipur", "Amer Fort, Jaipur": "Amer Fort, Jaipur · mural",
  "IMG_20250417_163723": "By the weir", "Bada Bagh 1": "Bada Bagh, Jaisalmer", "Bada Bagh, Jaisalmer 2": "Bada Bagh, Jaisalmer · II",
  "City Palace, Udaipur 2": "City Palace, Udaipur · II", "Mirjan fort , gokarna": "Mirjan Fort, Gokarna",
  "Pykara Falls , ooty": "Pykara Falls, Ooty", "Thar Rajasthan": "Thar, Rajasthan", "Pink city Jaipur_": "Pink City, Jaipur",
  "Bridge Udaipur_": "Bridge, Udaipur", "Lake Udaipur 2": "Lake Udaipur", "City palace": "City Palace",
  "Model Sitting (Male)": "Sitting, red and blue", "Model Sitting_": "Sitting", "Model lying (Starlight)": "Starlight",
  "Model with Champagne Glass": "Champagne", "Model with Dhup": "Dhup", "Rockstar Model": "Rockstar",
  "Smoking Model Boy": "Smoke · I", "Smoking Model Girl": "Smoke · II", "Model Reading Book": "Reading",
  "Model Lying on Steps": "Lying on steps", "Black Cat 1": "Black Cat · I", "Black Cat 2": "Black Cat · II",
  "Traditional dancer - Male": "Traditional dancer", "Ruqqaiya Engagement_": "Ruqqaiya, engagement",
  "Ruqqaiya Engagement 2": "Ruqqaiya, engagement · II", "Ruqqaiya Sisters_": "Ruqqaiya sisters", "Uncle 1": "Uncle",
  "Sunkissed portrait_": "Sunkissed", "kantara dance couple 1": "Kantara", "kathak": "Kathak", "mudra dancer": "Mudra",
  "Ecole intuit 1": "École Intuit Lab · I", "Ecole intuit 2": "École Intuit Lab · II", "Ecole intuit 3": "École Intuit Lab · III",
  "Ecole intuit 4": "École Intuit Lab · IV", "Ecole intuit 5": "École Intuit Lab · V", "Ecole intuit 6": "École Intuit Lab · VI",
  "Ecole intuit 7": "École Intuit Lab · VII", "Bellavita_": "Bella Vita", "Moisturizer_": "Lacto Calamine",
  "Monster_": "Monster Energy", "Ponds": "Pond’s", "Zara perfume_": "Zara", "Derma Sunscreen_": "Derma sunscreen",
  "King Of Good Times 1": "King of Good Times · I", "King of Good Times 2": "King of Good Times · II",
  "Little Cormorant 2": "Little cormorant · II", "Little Cormorant_": "Little cormorant", "Red Naped Ibis": "Red-naped ibis",
  "Lion tailed Monkey_": "Lion-tailed monkey", "camel": "Camel", "Bird Nest_": "Bird nest",
  "Women With Sitar Painting Recreation": "Woman with Sitar — the photograph",
  "Recreation of Women with Sitar": "Woman with Sitar — the reference",
}

ROMAN = {1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X"}

def caption(stem):
    if stem in CAPTIONS:
        return CAPTIONS[stem]
    s = stem.rstrip("_").strip()
    s = re.sub(r"\s*,\s*", ", ", s)
    s = s.replace("_", "’")
    m = re.match(r"^(.*?)\s*-\s*(.*?)\s+(\d+)$", s)          # "Bride - Groom 3" → "Bride & Groom · III"
    if m:
        return f"{m.group(1)} & {m.group(2)} · {ROMAN.get(int(m.group(3)), m.group(3))}"
    m = re.match(r"^(.*?)\s+(\d+)$", s)                        # "Turf 2" → "Turf · II"
    if m and not re.search(r"\d", m.group(1)):
        return f"{m.group(1)} · {ROMAN.get(int(m.group(2)), m.group(2))}"
    return s

def find_dir(name):
    want = name.strip().lower()
    for d in os.listdir(IMG_ROOT):
        if os.path.isdir(os.path.join(IMG_ROOT, d)) and d.strip().lower() == want:
            return d
    sys.exit(f"missing folder for {name!r} in {IMG_ROOT}")

def url(*parts):
    return quote("/".join(parts), safe="/")

def measure(path):
    im = Image.open(path)
    fmt = im.format
    im = ImageOps.exif_transpose(im)
    w, h = im.size
    if fmt in ("JPEG", "MPO"):
        im.draft("RGB", (160, 160))
    small = im.convert("RGB")
    small.thumbnail((48, 48))
    r, g, b = small.resize((1, 1), Image.LANCZOS).getpixel((0, 0))
    return w, h, f"#{r:02x}{g:02x}{b:02x}"

def stem(f):
    return os.path.splitext(f)[0]

albums_out, total = [], 0
for a in ALBUMS:
    d = find_dir(a["dir"])
    files = sorted(f for f in os.listdir(os.path.join(IMG_ROOT, d)) if os.path.splitext(f)[1].lower() in EXTS)
    order = {s: i for i, s in enumerate(a.get("order", []))}
    files.sort(key=lambda f: (order.get(stem(f), 10_000), f.lower()))
    images = []
    for f in files:
        w, h, avg = measure(os.path.join(IMG_ROOT, d, f))
        images.append({"f": f, "t": caption(stem(f)), "src": url(IMG_DIR, d, f), "w": w, "h": h, "avg": avg})
    by_file = {i["f"]: i for i in images}
    def cov(spec):
        f, x, y = spec
        if f not in by_file:
            sys.exit(f"cover {f!r} not found in {d!r}")
        return {"f": f, "src": by_file[f]["src"], "x": x, "y": y, "avg": by_file[f]["avg"]}
    albums_out.append({"id": a["id"], "title": a["title"], "desc": a["desc"], "count": len(images),
                       "cover": cov(a["cover"]), "coverM": cov(a["coverM"]), "images": images})
    total += len(images)
    print(f"{a['title']:20} {len(images):3} photographs  ({d!r})")

pd = find_dir(PROFILE_DIR)
pw, ph, pavg = measure(os.path.join(IMG_ROOT, pd, PROFILE_FILE))
profile = {"src": url(IMG_DIR, pd, PROFILE_FILE), "w": pw, "h": ph, "avg": pavg}

selected = []
for aid, s in SELECTED:
    alb = next(x for x in albums_out if x["id"] == aid)
    idx = next(i for i, im in enumerate(alb["images"]) if stem(im["f"]) == s)
    selected.append({"album": aid, "index": idx})

manifest = {"name": "Ronald Jefferson", "total": total, "profile": profile, "albums": albums_out, "selected": selected}
with open(OUT, "w") as fh:
    fh.write("/* Generated by assets/build-manifest.py — do not edit by hand. */\n")
    fh.write("window.PORTFOLIO = " + json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + ";\n")
print(f"\n{total} photographs in {len(albums_out)} albums → {os.path.relpath(OUT, ROOT)}")
