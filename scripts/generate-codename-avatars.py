#!/usr/bin/env python3
"""Generate a matching set of original, playful SVG codename mascots."""

from __future__ import annotations

import hashlib
import html
import math
import re
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src/lib/models/codenames.ts"
OUTPUT = ROOT / "static/codename-avatars"

PALETTES = [
    ("#e8f4eb", "#17603a", "#c92d4b", "#f4c95d"),
    ("#fce8e7", "#9f1239", "#17603a", "#f4c95d"),
    ("#e6f1f8", "#145374", "#c92d4b", "#f4c95d"),
    ("#fff2d6", "#744210", "#17603a", "#c92d4b"),
    ("#eee8f5", "#5b3b76", "#c92d4b", "#e0b85b"),
    ("#e4f2ee", "#245b52", "#b92342", "#efc34d"),
    ("#f8eadc", "#7a452a", "#237247", "#d52f4b"),
    ("#e7e9f4", "#404c80", "#b92745", "#e7be50"),
]

# Each codename gets a distinct mascot silhouette and a small identifying prop.
# The shared outline, face treatment, palette, and framing keep the set cohesive.
AVATARS: dict[str, tuple[str, str]] = {
    "Frosty": ("snowman", "top_hat"),
    "Jingle": ("bell", "music_note"),
    "Tinsel": ("round", "tinsel"),
    "Mistletoe": ("round", "mistletoe"),
    "Snowflake": ("snow", "snowflake"),
    "Candy Cane": ("candy", "candy_cane"),
    "Gingerbread": ("gingerbread", "icing"),
    "Peppermint": ("candy", "peppermint"),
    "Nutcracker": ("nutcracker", "soldier_hat"),
    "Snowball": ("snow", "snow_cap"),
    "Holly": ("round", "holly"),
    "Evergreen": ("tree", "ornaments"),
    "Kringle": ("baker", "santa_hat"),
    "Reindeer": ("reindeer", "antlers"),
    "Yule": ("log", "candle"),
    "Twinkle": ("star", "sparkles"),
    "Blizzard": ("cloud", "snowflakes"),
    "North Star": ("star", "halo"),
    "Sugarplum": ("plum", "leaf"),
    "Figgy Pudding": ("pudding", "holly"),
    "Cranberry Sauce": ("bowl", "berries"),
    "Roasted Chestnut": ("chestnut", "steam"),
    "Peppermint Bark": ("chocolate", "peppermint"),
    "Eggnog": ("mug", "nutmeg"),
    "Ginger Snap": ("gingerbread", "crumbs"),
    "Fruitcake": ("cake", "fruit"),
    "Sugar Cookie": ("cookie", "sprinkles"),
    "Candy Apple": ("apple", "leaf"),
    "Mince Pie": ("pie", "lattice"),
    "Hot Cocoa": ("mug", "marshmallows"),
    "Cinnamon Roll": ("roll", "icing"),
    "Toffee": ("toffee", "wrapper"),
    "Jingle Bells": ("bell", "double_bell"),
    "Silent Night": ("moon", "stars"),
    "Sleigh Ride": ("sleigh", "scarf"),
    "Carol Bells": ("bell", "music_notes"),
    "Deck the Halls": ("round", "garland"),
    "Winter Wonderland": ("snowman", "pine_trees"),
    "Silver Bells": ("bell", "silver_bell"),
    "Let It Snow": ("cloud", "snowflakes"),
    "Holly Jolly": ("round", "holly_crown"),
    "All Is Bright": ("bulb", "glow"),
    "Whoville": ("house", "curly_roof"),
    "Polar Express": ("train", "conductor_hat"),
    "Snow Miser": ("snowman", "ice_crown"),
    "Heat Miser": ("fire", "flame_hair"),
    "Grinch": ("mischief", "tuft"),
    "Snoopy": ("puppy", "floppy_ears"),
    "Rudolph": ("reindeer", "red_nose"),
    "Charlie Brown": ("kid", "zigzag"),
    "Frostbite": ("snowman", "ice_crown"),
    "Icicle": ("snow", "snowflake"),
    "Pinecone": ("tree", "pine_trees"),
    "Winterberry": ("bowl", "berries"),
    "Marshmallow": ("mug", "steam"),
    "Nutmeg": ("mug", "nutmeg"),
    "Gravy Boat": ("bowl", "berries"),
    "Sir Jingles": ("bell", "music_notes"),
    "Captain Tinsel": ("round", "tinsel"),
    "Merry Mayhem": ("bell", "double_bell"),
    "The Gift Goblin": ("mischief", "tuft"),
    "Jolly Belly": ("snowman", "scarf"),
    "Snow Problem": ("snowman", "snowflakes"),
    "Chilly Willy": ("snowman", "snow_cap"),
    "Jingle Pants": ("gingerbread", "zigzag"),
    "Wrapping Paper Bandit": ("candy", "wrapper"),
    "Pudding Bandit": ("pudding", "holly"),
    "Cocoa Commando": ("mug", "steam"),
    "Elf Esteem": ("kid", "sparkles"),
    "Sleigh What?": ("sleigh", "scarf"),
    "Frosty Mittens": ("snowman", "snow_cap"),
    "The Silent Snack": ("cookie", "crumbs"),
    "Tinsel Tornado": ("round", "garland"),
    "Dasher": ("reindeer", "antlers"),
    "Dancer": ("reindeer", "scarf"),
    "Prancer": ("reindeer", "holly"),
    "Vixen": ("reindeer", "sparkles"),
    "Comet": ("star", "sparkles"),
    "Cupid": ("star", "halo"),
    "Donner": ("reindeer", "red_nose"),
    "Blitzen": ("reindeer", "stars"),
    "Elf Wrangler": ("kid", "top_hat"),
    "Toy Tinkerer": ("train", "conductor_hat"),
    "North Pole Ninja": ("kid", "snow_cap"),
    "Sleigh Mechanic": ("train", "scarf"),
    "Gift Inspector": ("nutcracker", "soldier_hat"),
    "Midnight Delivery": ("sleigh", "stars"),
}

INK = "#563622"
CREAM = "#fff8e9"
BLUSH = "#e88778"


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def load_codenames() -> list[str]:
    source = SOURCE.read_text(encoding="utf-8")
    match = re.search(
        r"export const suggestedCodenames = \[(.*?)\] as const;",
        source,
        flags=re.DOTALL,
    )
    if not match:
        raise RuntimeError(f"Could not find suggestedCodenames in {SOURCE}")

    names = re.findall(r"^\s*'([^']+)'\s*,?\s*$", match.group(1), flags=re.MULTILINE)
    if len(names) < 50 or len(set(names)) != len(names):
        raise RuntimeError(f"Expected at least 50 unique codenames, found {len(names)}")
    missing = sorted(set(names) - set(AVATARS))
    if missing:
        raise RuntimeError(f"Avatar mapping is missing codenames: {missing}")
    return names


def colors_for(name: str) -> tuple[str, str, str, str]:
    seed = int.from_bytes(hashlib.sha256(name.lower().encode("utf-8")).digest()[:4], "big")
    return PALETTES[seed % len(PALETTES)]


def star_points(cx: int, cy: int, outer: int, inner: int) -> str:
    points = []
    for index in range(10):
        radius = outer if index % 2 == 0 else inner
        angle = math.radians(-90 + index * 36)
        points.append(f"{cx + radius * math.cos(angle):.1f},{cy + radius * math.sin(angle):.1f}")
    return " ".join(points)


def silhouette(kind: str, fill: str, accent: str, highlight: str) -> tuple[str, int, int]:
    """Return the mascot body and its face center."""
    stroke = INK
    head_y = 132
    face_y = 132
    if kind == "snowman":
        head_y, face_y = 100, 103
        art = f"""<circle cx="128" cy="174" r="48" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M92 154c17 13 55 13 72 0" fill="none" stroke="{accent}" stroke-width="12" stroke-linecap="round"/>
<circle cx="128" cy="102" r="59" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M98 153l30 9 30-9" fill="none" stroke="{highlight}" stroke-width="5" stroke-linecap="round"/>"""
    elif kind == "gingerbread":
        head_y, face_y = 91, 91
        art = f"""<path d="M128 124c-18 0-29 11-29 30v28l-31 31c-10 10-1 26 12 20l39-20 9-22 9 22 39 20c13 6 22-10 12-20l-31-31v-28c0-19-11-30-29-30z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<circle cx="128" cy="89" r="43" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M107 154h42M110 173h36" stroke="{CREAM}" stroke-width="7" stroke-linecap="round"/>
<circle cx="128" cy="150" r="6" fill="{accent}"/>"""
    elif kind == "bell":
        head_y, face_y = 125, 125
        art = f"""<path d="M75 160c13-17 18-31 18-57 0-27 15-46 35-46s35 19 35 46c0 26 5 40 18 57z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M68 162h120" stroke="{accent}" stroke-width="14" stroke-linecap="round"/>
<circle cx="128" cy="181" r="12" fill="{highlight}" stroke="{stroke}" stroke-width="5"/>"""
    elif kind == "candy":
        head_y, face_y = 132, 132
        art = f"""<circle cx="128" cy="133" r="68" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M85 101c16-16 46-18 65-2 17 14 15 41-3 53-18 12-37-4-28-18 6-10 20-6 18 4" fill="none" stroke="{accent}" stroke-width="11" stroke-linecap="round"/>
<path d="M90 178h76" stroke="{highlight}" stroke-width="7" stroke-linecap="round"/>"""
    elif kind == "nutcracker":
        head_y, face_y = 116, 121
        art = f"""<path d="M87 116c0-28 18-47 41-47s41 19 41 47v50c0 21-18 37-41 37s-41-16-41-37z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M79 112h98M94 159h68" stroke="{accent}" stroke-width="9" stroke-linecap="round"/>
<path d="M106 176h44" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>
<path d="M97 70h62" stroke="{stroke}" stroke-width="13" stroke-linecap="round"/>"""
    elif kind == "tree":
        head_y, face_y = 137, 137
        art = f"""<path d="M128 43l-40 50h22l-38 44h31l-42 51h134l-42-51h31l-38-44h22z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M118 186h20v31h-20z" fill="{accent}" stroke="{stroke}" stroke-width="5"/>"""
    elif kind == "star":
        head_y, face_y = 132, 132
        art = f"""<polygon points="{star_points(128, 132, 88, 42)}" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>"""
    elif kind == "plum":
        head_y, face_y = 135, 135
        art = f"""<path d="M128 69c-34-31-74-1-63 45 9 38 39 73 63 89 24-16 54-51 63-89 11-46-29-76-63-45z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M128 73c-5-23 4-36 20-45" fill="none" stroke="{stroke}" stroke-width="8" stroke-linecap="round"/>"""
    elif kind == "pudding":
        head_y, face_y = 137, 137
        art = f"""<path d="M68 160c5-53 28-83 60-83s55 30 60 83c-29 27-91 27-120 0z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M76 157c30 17 74 17 104 0" fill="none" stroke="{accent}" stroke-width="11" stroke-linecap="round"/>
<circle cx="128" cy="72" r="12" fill="{highlight}" stroke="{stroke}" stroke-width="5"/>"""
    elif kind == "bowl":
        head_y, face_y = 120, 122
        art = f"""<path d="M70 128h116c-7 58-29 83-58 83s-51-25-58-83z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<ellipse cx="128" cy="128" rx="60" ry="22" fill="{highlight}" stroke="{stroke}" stroke-width="7"/>
<circle cx="105" cy="120" r="10" fill="{accent}"/><circle cx="132" cy="112" r="10" fill="{accent}"/><circle cx="153" cy="125" r="10" fill="{accent}"/>"""
    elif kind == "chestnut":
        head_y, face_y = 138, 139
        art = f"""<path d="M65 158c5-50 30-82 63-82s58 32 63 82c-31 34-95 34-126 0z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M79 129c22-22 75-25 98-3" fill="none" stroke="{accent}" stroke-width="9" stroke-linecap="round"/>"""
    elif kind == "chocolate":
        head_y, face_y = 132, 133
        art = f"""<rect x="65" y="67" width="126" height="132" rx="20" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M107 70v126M151 70v126M68 111h120M68 155h120" stroke="{highlight}" stroke-width="5" opacity=".8"/>
<path d="M82 87h20M126 87h20M169 130v18" stroke="{accent}" stroke-width="7" stroke-linecap="round"/>"""
    elif kind == "mug":
        head_y, face_y = 127, 131
        art = f"""<path d="M164 95h22c24 0 24 54 0 54h-22" fill="none" stroke="{stroke}" stroke-width="12"/>
<rect x="69" y="75" width="104" height="124" rx="20" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M87 188h68" stroke="{highlight}" stroke-width="7" stroke-linecap="round"/>
<path d="M94 62c-12-14 8-20-2-34M128 62c-12-14 8-20-2-34M157 62c-12-14 8-20-2-34" fill="none" stroke="{accent}" stroke-width="7" stroke-linecap="round"/>"""
    elif kind == "cake":
        head_y, face_y = 133, 129
        art = f"""<path d="M69 127h118v68H69z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M69 127l29-48h89v48" fill="{highlight}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M83 153h90M83 177h90" stroke="{accent}" stroke-width="7" stroke-linecap="round"/>
<circle cx="101" cy="105" r="7" fill="{accent}"/><circle cx="150" cy="102" r="8" fill="{accent}"/>"""
    elif kind == "cookie":
        head_y, face_y = 132, 134
        art = f"""<circle cx="128" cy="133" r="68" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<circle cx="86" cy="105" r="7" fill="{accent}"/><circle cx="163" cy="100" r="8" fill="{accent}"/>
<circle cx="91" cy="163" r="6" fill="{accent}"/><circle cx="169" cy="160" r="7" fill="{accent}"/>
<circle cx="146" cy="186" r="6" fill="{accent}"/>"""
    elif kind == "apple":
        head_y, face_y = 139, 140
        art = f"""<path d="M128 97c-40-35-79 4-61 54 14 40 39 62 61 47 22 15 47-7 61-47 18-50-21-89-61-54z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M128 98c-4-24 5-37 23-45" fill="none" stroke="{stroke}" stroke-width="8" stroke-linecap="round"/>"""
    elif kind == "pie":
        head_y, face_y = 133, 136
        art = f"""<path d="M65 161c8-55 33-84 63-84s55 29 63 84H65z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M74 151l103-42M94 95l46 65M140 85l37 56" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>
<path d="M61 166h134" stroke="{stroke}" stroke-width="10" stroke-linecap="round"/>"""
    elif kind == "roll":
        head_y, face_y = 132, 135
        art = f"""<circle cx="128" cy="133" r="68" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M85 130c0-25 25-43 49-30 20 11 14 38-5 38-13 0-16-16-7-21M91 164c20 17 52 18 74 0" fill="none" stroke="{accent}" stroke-width="10" stroke-linecap="round"/>
<path d="M98 91h60" stroke="{highlight}" stroke-width="7" stroke-linecap="round"/>"""
    elif kind == "toffee":
        head_y, face_y = 128, 132
        art = f"""<path d="M77 88l21 17v69l-21 17-11-16V104zM179 88l-21 17v69l21 17 11-16v-81z" fill="{accent}" stroke="{stroke}" stroke-width="6" stroke-linejoin="round"/>
<rect x="91" y="86" width="74" height="100" rx="22" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M102 95h52" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>"""
    elif kind == "moon":
        head_y, face_y = 132, 133
        art = f"""<path d="M155 55c-43 6-69 45-58 87 9 36 42 57 77 48-18 24-51 34-82 22-39-15-58-59-43-98 15-40 59-61 99-46z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>"""
    elif kind == "sleigh":
        head_y, face_y = 125, 129
        art = f"""<path d="M67 154h122c-12 25-35 38-68 38H88z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M66 194c31 14 92 14 126-3" fill="none" stroke="{accent}" stroke-width="8" stroke-linecap="round"/>
<path d="M81 148c8-42 25-63 51-63s44 21 51 63z" fill="{highlight}" stroke="{stroke}" stroke-width="7"/>"""
    elif kind == "cloud":
        head_y, face_y = 133, 133
        art = f"""<path d="M70 171c-26-3-37-34-17-52 8-7 18-10 28-8 7-35 52-45 72-16 28-11 57 14 47 42 20 25-2 57-31 54H76c-2 0-4 0-6-1z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>"""
    elif kind == "bulb":
        head_y, face_y = 119, 122
        art = f"""<path d="M128 54c-39 0-66 29-62 65 3 21 16 32 28 46 7 9 10 18 11 25h46c1-7 4-16 11-25 12-14 25-25 28-46 4-36-23-65-62-65z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M104 198h48M108 211h40" stroke="{accent}" stroke-width="9" stroke-linecap="round"/>
<path d="M110 56c7-17 29-17 36 0" fill="none" stroke="{highlight}" stroke-width="7" stroke-linecap="round"/>"""
    elif kind == "house":
        head_y, face_y = 139, 138
        art = f"""<path d="M58 120l70-63 70 63v82H58z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M46 121l82-75 82 75" fill="none" stroke="{accent}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="113" y="158" width="30" height="44" rx="8" fill="{highlight}" stroke="{stroke}" stroke-width="5"/>"""
    elif kind == "train":
        head_y, face_y = 130, 130
        art = f"""<path d="M59 106h113l28 36v42H59z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M139 106V73h25v33M134 67h36v10h-36z" fill="{accent}" stroke="{stroke}" stroke-width="5"/>
<rect x="77" y="118" width="30" height="24" rx="6" fill="{highlight}"/>
<circle cx="91" cy="186" r="15" fill="{highlight}" stroke="{stroke}" stroke-width="6"/>
<circle cx="165" cy="186" r="15" fill="{highlight}" stroke="{stroke}" stroke-width="6"/>"""
    elif kind == "fire":
        head_y, face_y = 134, 135
        art = f"""<path d="M128 47c16 34-9 47 18 75 4-20 21-29 18-48 38 33 49 76 25 110-26 37-95 38-124 0-28-37-8-83 33-111-5 26 4 37 15 44 14-27-4-44 15-70z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M128 131c16 18 20 30 13 49-7 17-27 19-38 5-12-15 0-39 25-54z" fill="{highlight}"/>"""
    elif kind == "mischief":
        head_y, face_y = 133, 135
        art = f"""<path d="M65 116c-8-35 27-60 55-39 17-31 57-19 59 14 37 6 49 45 18 63 7 32-27 55-55 37-31 27-70 3-64-31-28-4-37-29-13-44z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M78 104c20 8 38 8 54 0M130 105c17 9 32 9 48 1" fill="none" stroke="{accent}" stroke-width="8" stroke-linecap="round"/>"""
    elif kind == "puppy":
        head_y, face_y = 133, 136
        art = f"""<path d="M82 101c-34-47-57 1-41 57 10 35 34 31 51 8zM174 101c34-47 57 1 41 57-10 35-34 31-51 8z" fill="{accent}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<ellipse cx="128" cy="137" rx="61" ry="62" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<ellipse cx="128" cy="157" rx="29" ry="22" fill="{highlight}"/>
<ellipse cx="128" cy="149" rx="10" ry="8" fill="{stroke}"/>"""
    elif kind == "reindeer":
        head_y, face_y = 137, 139
        art = f"""<path d="M91 91L77 57 53 45M78 59H51M165 91l14-34 24-12M178 59h27" fill="none" stroke="{stroke}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M68 128c0-41 25-67 60-67s60 26 60 67c0 47-25 76-60 76s-60-29-60-76z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>"""
    elif kind == "kid":
        head_y, face_y = 112, 115
        art = f"""<path d="M80 105c-8-42 21-68 55-58 31 9 47 40 37 75l-15 28H93z" fill="{fill}" stroke="{stroke}" stroke-width="7" stroke-linejoin="round"/>
<path d="M75 189c9-29 28-43 53-43s44 14 53 43v18H75z" fill="{accent}" stroke="{stroke}" stroke-width="7"/>
<path d="M80 187l16 16 16-16 16 16 16-16 16 16 16-16" fill="none" stroke="{highlight}" stroke-width="7" stroke-linejoin="round"/>"""
    elif kind == "baker":
        head_y, face_y = 121, 119
        art = f"""<path d="M84 144c0-43 18-68 44-68s44 25 44 68v24c0 25-18 42-44 42s-44-17-44-42z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<path d="M90 148q38 21 76 0v29q-38 49-76 0z" fill="{CREAM}" stroke="{stroke}" stroke-width="5" stroke-linejoin="round"/>
<path d="M99 201h58" stroke="{accent}" stroke-width="9" stroke-linecap="round"/>"""
    elif kind == "log":
        head_y, face_y = 138, 138
        art = f"""<path d="M76 86h103c15 0 26 12 26 26v55c0 15-11 26-26 26H76c-15 0-26-11-26-26v-55c0-14 11-26 26-26z" fill="{fill}" stroke="{stroke}" stroke-width="7"/>
<ellipse cx="79" cy="139" rx="21" ry="39" fill="{highlight}" stroke="{stroke}" stroke-width="6"/>
<path d="M65 139c0-18 22-18 22 0s-22 18-22 0z" fill="{accent}" stroke="{stroke}" stroke-width="4"/>"""
    else:
        head_y, face_y = 132, 132
        art = f"""<circle cx="128" cy="133" r="68" fill="{fill}" stroke="{stroke}" stroke-width="7"/>"""
    return art, head_y, face_y


def expression(name: str, cx: int, cy: int, accent: str) -> str:
    seed = hashlib.sha256(name.encode("utf-8")).digest()[0] % 3
    eye_y = cy - 11
    left_x, right_x = cx - 21, cx + 21
    eyes = (
        f'<circle cx="{left_x}" cy="{eye_y}" r="6" fill="{INK}"/>'
        f'<circle cx="{right_x}" cy="{eye_y}" r="6" fill="{INK}"/>'
    )
    if seed == 1:
        eyes = (
            f'<path d="M{left_x-6} {eye_y}q6-8 12 0" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
            f'<circle cx="{right_x}" cy="{eye_y}" r="6" fill="{INK}"/>'
        )
    elif seed == 2:
        eyes = (
            f'<circle cx="{left_x}" cy="{eye_y}" r="7" fill="{INK}"/>'
            f'<circle cx="{right_x}" cy="{eye_y}" r="7" fill="{INK}"/>'
            f'<circle cx="{left_x-2}" cy="{eye_y-2}" r="2" fill="{CREAM}"/>'
            f'<circle cx="{right_x-2}" cy="{eye_y-2}" r="2" fill="{CREAM}"/>'
        )
    mouth_y = cy + 10
    smile = (
        f'<path d="M{cx-16} {mouth_y}q16 18 32 0" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
        if seed != 2
        else f'<ellipse cx="{cx}" cy="{mouth_y+5}" rx="7" ry="10" fill="{INK}"/>'
    )
    cheeks = (
        f'<circle cx="{cx-36}" cy="{cy+7}" r="8" fill="{BLUSH}"/>'
        f'<circle cx="{cx+36}" cy="{cy+7}" r="8" fill="{BLUSH}"/>'
    )
    return eyes + cheeks + smile


def accessory(kind: str, accent: str, highlight: str, ink: str) -> str:
    props = {
        "top_hat": f'<path d="M91 69h74l-9-33h-56z" fill="{ink}" stroke="{ink}" stroke-width="6" stroke-linejoin="round"/><path d="M83 70h90" stroke="{accent}" stroke-width="12" stroke-linecap="round"/><circle cx="152" cy="35" r="8" fill="{highlight}"/>',
        "music_note": f'<path d="M181 76V39l27-7v35" fill="none" stroke="{accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><ellipse cx="174" cy="70" rx="9" ry="6" fill="{accent}"/><ellipse cx="201" cy="65" rx="9" ry="6" fill="{accent}"/>',
        "tinsel": f'<path d="M67 90q20-25 40 0t40 0 42 0" fill="none" stroke="{highlight}" stroke-width="9" stroke-linecap="round"/><circle cx="82" cy="63" r="7" fill="{accent}"/><circle cx="172" cy="61" r="7" fill="{accent}"/>',
        "mistletoe": f'<path d="M128 76q-25-43-51-20 4 28 48 31M130 77q26-43 51-20-4 28-48 31" fill="{highlight}" stroke="{ink}" stroke-width="5"/><circle cx="118" cy="91" r="8" fill="{accent}"/><circle cx="136" cy="94" r="8" fill="{accent}"/>',
        "snowflake": f'<path d="M128 28v49M106 40l22 16 22-16M86 46l42 24M91 69l-2-17 15-5M170 46l-42 24M165 69l2-17-15-5" fill="none" stroke="{highlight}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
        "snowflakes": f'<path d="M91 41v25M80 47l11 8 11-8M171 50v25M160 56l11 8 11-8" fill="none" stroke="{highlight}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>',
        "candy_cane": f'<path d="M178 167V73c0-38-53-42-57-4" fill="none" stroke="{CREAM}" stroke-width="25" stroke-linecap="round"/><path d="M178 145v-25M178 98V79c0-12-11-20-22-17" fill="none" stroke="{accent}" stroke-width="9" stroke-linecap="round"/>',
        "icing": f'<path d="M88 68q18 17 35 0 18 17 36 0" fill="none" stroke="{CREAM}" stroke-width="9" stroke-linecap="round"/><circle cx="91" cy="79" r="5" fill="{CREAM}"/><circle cx="165" cy="79" r="5" fill="{CREAM}"/>',
        "soldier_hat": f'<path d="M82 75q5-47 46-47t46 47z" fill="{accent}" stroke="{ink}" stroke-width="6"/><path d="M75 77h106" stroke="{highlight}" stroke-width="11" stroke-linecap="round"/><circle cx="128" cy="39" r="8" fill="{highlight}"/>',
        "snow_cap": f'<path d="M78 76q9-40 50-40t50 40z" fill="{CREAM}" stroke="{ink}" stroke-width="6"/><path d="M75 77h106" stroke="{highlight}" stroke-width="10" stroke-linecap="round"/><circle cx="128" cy="35" r="8" fill="{CREAM}"/>',
        "holly": f'<path d="M117 75q-32-37-52-5 7 28 52 20M137 75q32-37 52-5-7 28-52 20" fill="{highlight}" stroke="{ink}" stroke-width="5"/><circle cx="124" cy="86" r="8" fill="{accent}"/><circle cx="139" cy="88" r="8" fill="{accent}"/>',
        "ornaments": f'<path d="M81 36v57M128 25v54M174 38v56" stroke="{ink}" stroke-width="5"/><circle cx="81" cy="104" r="12" fill="{accent}" stroke="{ink}" stroke-width="4"/><circle cx="128" cy="89" r="12" fill="{highlight}" stroke="{ink}" stroke-width="4"/><circle cx="174" cy="104" r="12" fill="{accent}" stroke="{ink}" stroke-width="4"/>',
        "santa_hat": f'<path d="M80 78q15-50 65-47 26 2 34 35-42-8-78 20z" fill="{accent}" stroke="{ink}" stroke-width="6" stroke-linejoin="round"/><path d="M78 81q45-24 101-9" fill="none" stroke="{CREAM}" stroke-width="12" stroke-linecap="round"/><circle cx="179" cy="32" r="10" fill="{CREAM}" stroke="{ink}" stroke-width="4"/>',
        "antlers": f'<path d="M91 94L78 61 57 49M78 63H53M165 94l13-33 21-12M178 63h25" fill="none" stroke="{ink}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>',
        "candle": f'<path d="M128 74V35M114 43q14-24 28 0" fill="none" stroke="{accent}" stroke-width="7" stroke-linecap="round"/><path d="M128 55c-14-13 9-19 0-34 22 15 15 29 0 34z" fill="{highlight}" stroke="{ink}" stroke-width="4"/>',
        "sparkles": f'<polygon points="{star_points(65, 87, 16, 7)}" fill="{highlight}" stroke="{ink}" stroke-width="3"/><polygon points="{star_points(192, 91, 18, 8)}" fill="{accent}" stroke="{ink}" stroke-width="3"/>',
        "halo": f'<ellipse cx="128" cy="37" rx="42" ry="12" fill="none" stroke="{highlight}" stroke-width="7"/><path d="M101 43l-8 16M155 43l8 16" stroke="{highlight}" stroke-width="5" stroke-linecap="round"/>',
        "leaf": f'<path d="M127 76q-28-39-50-12 7 31 50 26M131 76q28-39 50-12-7 31-50 26" fill="{highlight}" stroke="{ink}" stroke-width="5"/><path d="M128 82V42" stroke="{ink}" stroke-width="6" stroke-linecap="round"/>',
        "berries": f'<path d="M92 68q36-29 72 0" fill="none" stroke="{highlight}" stroke-width="7" stroke-linecap="round"/><circle cx="108" cy="69" r="10" fill="{accent}" stroke="{ink}" stroke-width="4"/><circle cx="128" cy="59" r="10" fill="{accent}" stroke="{ink}" stroke-width="4"/><circle cx="148" cy="69" r="10" fill="{accent}" stroke="{ink}" stroke-width="4"/>',
        "steam": f'<path d="M101 71c-14-17 11-22-2-40M128 71c-14-17 11-22-2-40M155 71c-14-17 11-22-2-40" fill="none" stroke="{CREAM}" stroke-width="6" stroke-linecap="round"/>',
        "peppermint": f'<circle cx="128" cy="62" r="23" fill="{CREAM}" stroke="{ink}" stroke-width="5"/><path d="M128 39q14 15 23 23M105 62q14 15 23 23M128 62h23M128 62V39" fill="none" stroke="{accent}" stroke-width="7" stroke-linecap="round"/>',
        "nutmeg": f'<circle cx="96" cy="61" r="7" fill="{accent}"/><circle cx="128" cy="48" r="7" fill="{highlight}"/><circle cx="160" cy="61" r="7" fill="{accent}"/>',
        "crumbs": f'<circle cx="84" cy="56" r="6" fill="{highlight}"/><circle cx="105" cy="42" r="5" fill="{accent}"/><circle cx="173" cy="51" r="7" fill="{highlight}"/><circle cx="151" cy="39" r="5" fill="{accent}"/>',
        "fruit": f'<circle cx="97" cy="59" r="9" fill="{accent}"/><circle cx="128" cy="43" r="8" fill="{highlight}"/><circle cx="159" cy="59" r="9" fill="{accent}"/>',
        "lattice": f'<path d="M92 70l72-36M88 52l55 33M118 35l48 30" stroke="{CREAM}" stroke-width="7" stroke-linecap="round"/>',
        "sprinkles": f'<path d="M82 59l12-5M107 39l9 5M148 42l11-6M171 62l10 4" stroke="{accent}" stroke-width="7" stroke-linecap="round"/><circle cx="128" cy="37" r="6" fill="{highlight}"/>',
        "wrapper": f'<path d="M74 67l20 13M182 67l-20 13" stroke="{accent}" stroke-width="9" stroke-linecap="round"/><path d="M94 80h68" stroke="{CREAM}" stroke-width="8" stroke-linecap="round"/>',
        "double_bell": f'<path d="M93 70c9-25 38-25 47 0M142 70c9-25 38-25 47 0" fill="none" stroke="{highlight}" stroke-width="8"/><circle cx="116" cy="77" r="10" fill="{accent}"/><circle cx="166" cy="77" r="10" fill="{accent}"/>',
        "stars": f'<path d="M88 56l5 12 12 5-12 5-5 12-5-12-12-5 12-5zM176 44l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="{highlight}"/>',
        "scarf": f'<path d="M77 77q51 20 102 0M153 77l14 37" fill="none" stroke="{accent}" stroke-width="11" stroke-linecap="round"/><path d="M159 109l13-2-5 13" fill="{accent}" stroke="{ink}" stroke-width="3"/>',
        "music_notes": f'<path d="M73 80V43l24-6v31M165 69V32l24-6v31" fill="none" stroke="{accent}" stroke-width="6" stroke-linecap="round"/><ellipse cx="68" cy="77" rx="8" ry="5" fill="{accent}"/><ellipse cx="160" cy="66" rx="8" ry="5" fill="{accent}"/>',
        "garland": f'<path d="M62 71q33 28 66 0t66 0" fill="none" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/><circle cx="81" cy="79" r="7" fill="{accent}"/><circle cx="128" cy="71" r="7" fill="{accent}"/><circle cx="175" cy="79" r="7" fill="{accent}"/>',
        "pine_trees": f'<path d="M78 84l18-29 18 29zM144 82l20-33 20 33z" fill="{highlight}" stroke="{ink}" stroke-width="4" stroke-linejoin="round"/>',
        "silver_bell": f'<path d="M170 71c-13-14-12-28 0-39M162 37h15" fill="none" stroke="{ink}" stroke-width="5" stroke-linecap="round"/><circle cx="171" cy="32" r="7" fill="{CREAM}" stroke="{ink}" stroke-width="4"/>',
        "holly_crown": f'<path d="M73 69q24 22 54 5 31 17 56-5" fill="none" stroke="{accent}" stroke-width="8" stroke-linecap="round"/><path d="M96 60q-10-25-29-12 5 21 30 22M156 60q10-25 29-12-5 21-30 22" fill="{highlight}" stroke="{ink}" stroke-width="4"/><circle cx="127" cy="63" r="8" fill="{accent}"/>',
        "glow": f'<circle cx="128" cy="49" r="23" fill="{highlight}" stroke="{ink}" stroke-width="5"/><path d="M128 12v13M76 28l10 10M180 28l-10 10M56 70h15M185 70h15" stroke="{highlight}" stroke-width="5" stroke-linecap="round"/>',
        "curly_roof": f'<path d="M67 80q-23-31 6-40 17-6 23 11 6-24 26-18 18 6 7 24 22-21 39-4 15 14-2 28" fill="none" stroke="{accent}" stroke-width="9" stroke-linecap="round"/>',
        "conductor_hat": f'<path d="M83 75q5-42 45-42t45 42z" fill="{accent}" stroke="{ink}" stroke-width="6"/><path d="M78 76h100" stroke="{CREAM}" stroke-width="10" stroke-linecap="round"/><circle cx="128" cy="34" r="7" fill="{highlight}"/>',
        "ice_crown": f'<path d="M81 78l13-30 19 20 15-35 16 35 20-20 12 30z" fill="{highlight}" stroke="{ink}" stroke-width="5" stroke-linejoin="round"/>',
        "flame_hair": f'<path d="M90 76c-13-23 15-28 5-48 24 9 14 25 29 29 19-23 31-25 32-44 27 33-4 53 11 64z" fill="{accent}" stroke="{ink}" stroke-width="5" stroke-linejoin="round"/>',
        "tuft": f'<path d="M92 79q-23-30 5-38 11-3 20 9 3-29 23-27 17 1 17 22 27-15 34 7 5 16-18 27" fill="{accent}" stroke="{ink}" stroke-width="5" stroke-linejoin="round"/>',
        "floppy_ears": f'<path d="M93 103c-36-50-54-9-38 31 9 21 24 23 43 2M163 103c36-50 54-9 38 31-9 21-24 23-43 2" fill="{accent}" stroke="{ink}" stroke-width="6" stroke-linejoin="round"/>',
        "red_nose": f'<circle cx="128" cy="151" r="14" fill="#e23b48" stroke="{ink}" stroke-width="5"/><path d="M89 68L76 46 59 38M76 48H54M167 68l13-22 17-8M180 48h22" fill="none" stroke="{ink}" stroke-width="7" stroke-linecap="round"/>',
        "zigzag": f'<path d="M77 70l18 13 18-13 18 13 18-13 18 13 18-13" fill="none" stroke="{highlight}" stroke-width="9" stroke-linejoin="round"/>',
    }
    return props.get(kind, "")


def facial_features(name: str, kind: str, face_y: int, accent: str) -> str:
    if kind in {"gingerbread", "nutcracker", "puppy", "reindeer", "kid"}:
        # These mascots already use separate eye spacing, so keep the shared face
        # slightly smaller to fit their distinctive head shapes.
        eye_radius = 5
        cheek_radius = 6
    else:
        eye_radius = 6
        cheek_radius = 7
    seed = hashlib.sha256(name.encode("utf-8")).digest()[4] % 3
    left_x, right_x = 108, 148
    eye_y = face_y - 10
    if seed == 1:
        eyes = (
            f'<path d="M{left_x-6} {eye_y}q6-8 12 0" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
            f'<circle cx="{right_x}" cy="{eye_y}" r="{eye_radius}" fill="{INK}"/>'
        )
    else:
        eyes = (
            f'<circle cx="{left_x}" cy="{eye_y}" r="{eye_radius}" fill="{INK}"/>'
            f'<circle cx="{right_x}" cy="{eye_y}" r="{eye_radius}" fill="{INK}"/>'
            f'<circle cx="{left_x-2}" cy="{eye_y-2}" r="2" fill="{CREAM}"/>'
            f'<circle cx="{right_x-2}" cy="{eye_y-2}" r="2" fill="{CREAM}"/>'
        )
    smile_y = face_y + 12
    if seed == 2:
        mouth = f'<ellipse cx="128" cy="{smile_y+4}" rx="7" ry="9" fill="{INK}"/>'
    else:
        mouth = f'<path d="M114 {smile_y}q14 16 28 0" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
    cheeks = (
        f'<circle cx="91" cy="{face_y+7}" r="{cheek_radius}" fill="{BLUSH}"/>'
        f'<circle cx="165" cy="{face_y+7}" r="{cheek_radius}" fill="{BLUSH}"/>'
    )
    return eyes + cheeks + mouth


def svg_art(name: str, fill: str, accent: str, highlight: str) -> str:
    kind, prop = AVATARS.get(name, ("snow", "snowflake"))
    body, head_y, face_y = silhouette(kind, fill, accent, highlight)
    extra = accessory(prop, accent, highlight, INK)
    face = facial_features(name, kind, face_y, accent)

    if kind == "snowman":
        face += f'<path d="M129 {face_y+4}l21 7-19 7z" fill="#ee883c" stroke="{INK}" stroke-width="3" stroke-linejoin="round"/>'
    elif kind == "reindeer" and prop != "red_nose":
        face += f'<circle cx="128" cy="{face_y+18}" r="9" fill="{accent}" stroke="{INK}" stroke-width="4"/>'
    elif kind == "puppy":
        face += f'<path d="M110 {face_y+8}q18 19 36 0" fill="none" stroke="{INK}" stroke-width="5" stroke-linecap="round"/>'
    elif kind == "gingerbread":
        face += f'<path d="M112 {face_y+4}q16 13 32 0" fill="none" stroke="{CREAM}" stroke-width="4" stroke-linecap="round"/>'

    return f"{body}\n{extra}\n{face}"


def svg_for(name: str) -> str:
    background, foreground, accent, highlight = colors_for(name)
    illustration = svg_art(name, foreground, accent, highlight)
    title = html.escape(f"Funny holiday mascot for {name}")
    seed = hashlib.sha256(name.lower().encode("utf-8")).digest()
    left_star_y = 47 + seed[0] % 13
    right_star_y = 45 + seed[1] % 17
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title">
  <title id="title">{title}</title>
  <circle cx="128" cy="128" r="124" fill="{background}"/>
  <circle cx="128" cy="128" r="120" fill="none" stroke="{foreground}" stroke-opacity=".24" stroke-width="4"/>
  <path d="M49 {left_star_y}l4 9 9 4-9 4-4 9-4-9-9-4 9-4z" fill="{highlight}"/>
  <path d="M204 {right_star_y}l4 7 7 4-7 4-4 7-4-7-7-4 7-4z" fill="{accent}"/>
  {illustration}
</svg>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="Create only codename SVGs that do not already exist.",
    )
    args = parser.parse_args()

    OUTPUT.mkdir(parents=True, exist_ok=True)
    codenames = load_codenames()
    names_to_generate = [
        name
        for name in codenames
        if not args.missing_only or not (OUTPUT / f"{slugify(name)}.svg").exists()
    ]
    generated_slugs = {slugify(name) for name in names_to_generate}
    for codename in names_to_generate:
        (OUTPUT / f"{slugify(codename)}.svg").write_text(svg_for(codename), encoding="utf-8")
    if not args.missing_only:
        (OUTPUT / "default.svg").write_text(svg_for("default"), encoding="utf-8")
        generated_slugs.add("default")

    for slug in generated_slugs:
        png_path = OUTPUT / f"{slug}.png"
        if png_path.exists():
            png_path.unlink()
    print(f"Generated {len(names_to_generate)} funny, matching SVG mascots in {OUTPUT}")


if __name__ == "__main__":
    main()
