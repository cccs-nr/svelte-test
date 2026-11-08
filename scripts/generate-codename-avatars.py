#!/usr/bin/env python3
"""Generate original, self-contained SVG avatars for all suggested codenames."""

from __future__ import annotations

import hashlib
import math
import re
from html import escape
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
    if len(names) != 50 or len(set(names)) != 50:
        raise RuntimeError(f"Expected 50 unique codenames, found {len(names)}")
    return names


def colors_for(name: str) -> tuple[str, str, str, str]:
    seed = int.from_bytes(hashlib.sha256(name.lower().encode("utf-8")).digest()[:4], "big")
    return PALETTES[seed % len(PALETTES)]


def star(color: str, outer: int = 54, inner: int = 25) -> str:
    points = []
    for index in range(10):
        radius = outer if index % 2 == 0 else inner
        angle = math.radians(-90 + index * 36)
        points.append(
            f"{128 + radius * math.cos(angle):.1f},{128 + radius * math.sin(angle):.1f}"
        )
    return f'<polygon points="{" ".join(points)}" fill="{color}"/>'


def snowflake(foreground: str, accent: str, highlight: str) -> str:
    return f"""<path d="M128 57v142M67 93l122 70M67 163l122-70" stroke="{foreground}" stroke-width="11" stroke-linecap="round"/>
<path d="M108 76l20 18 20-18M108 180l20-18 20 18M73 109l18 19-18 19M183 109l-18 19 18 19" fill="none" stroke="{accent}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="128" cy="128" r="13" fill="{highlight}"/>"""


def bell(foreground: str, accent: str, highlight: str) -> str:
    return f"""<path d="M82 169c13-18 18-31 18-57 0-23 12-40 28-40s28 17 28 40c0 26 5 39 18 57z" fill="{highlight}" stroke="{foreground}" stroke-width="8" stroke-linejoin="round"/>
<path d="M75 170h106" stroke="{accent}" stroke-width="15" stroke-linecap="round"/>
<circle cx="128" cy="194" r="12" fill="{foreground}"/>
<path d="M105 67l-10-13M151 67l10-13" stroke="{accent}" stroke-width="8" stroke-linecap="round"/>"""


def mug(foreground: str, accent: str, highlight: str) -> str:
    return f"""<path d="M164 95h17c23 0 23 48 0 48h-17" fill="none" stroke="{foreground}" stroke-width="13"/>
<path d="M78 83h89v97c0 14-10 24-24 24h-41c-14 0-24-10-24-24z" fill="{accent}"/>
<ellipse cx="122" cy="84" rx="45" ry="14" fill="{foreground}"/>
<path d="M97 70c-9-13 9-17 0-30M126 70c-9-13 9-17 0-30M151 70c-9-13 9-17 0-30" fill="none" stroke="{highlight}" stroke-width="7" stroke-linecap="round"/>
<path d="M95 181h56" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>"""


def food_icon(name: str, foreground: str, accent: str, highlight: str) -> str:
    value = name.lower()
    if "candy cane" in value:
        return f"""<path d="M93 198V93c0-54 70-54 70 0v20" fill="none" stroke="{accent}" stroke-width="42" stroke-linecap="round"/>
<path d="M93 165h42M93 124h42M116 66c17-7 34 3 39 19" fill="none" stroke="{highlight}" stroke-width="12" stroke-linecap="round"/>
<path d="M66 205h124" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>"""
    if "cocoa" in value or "eggnog" in value:
        return mug(foreground, accent, highlight)
    if "cinnamon roll" in value:
        return f"""<circle cx="128" cy="128" r="63" fill="{highlight}" stroke="{foreground}" stroke-width="8"/>
<path d="M92 124c0-20 19-33 38-25 16 7 11 30-4 30-10 0-13-12-6-17M91 159c20 17 51 18 73 1" fill="none" stroke="{accent}" stroke-width="10" stroke-linecap="round"/>
<path d="M103 91h50" stroke="{foreground}" stroke-width="7" stroke-linecap="round"/>"""
    if "peppermint bark" in value:
        return f"""<rect x="77" y="88" width="102" height="80" rx="10" fill="{foreground}"/>
<path d="M87 99h82v58H87z" fill="{highlight}"/>
<path d="M92 105l27 30M126 104l30 32M99 143l15 13M146 141l16 15" stroke="{accent}" stroke-width="12" stroke-linecap="round"/>"""
    if "cranberry" in value:
        berries = "".join(
            f'<circle cx="{x}" cy="{y}" r="11" fill="{accent}"/>'
            for x, y in ((94, 114), (117, 102), (141, 111), (162, 124), (107, 136), (133, 134), (153, 148))
        )
        return f"""<path d="M70 111c12 81 104 81 116 0z" fill="{foreground}"/>
<ellipse cx="128" cy="109" rx="60" ry="21" fill="{highlight}"/>{berries}"""
    if "chestnut" in value:
        return f"""<path d="M72 159c4-48 24-80 56-80s52 32 56 80c-28 30-84 30-112 0z" fill="{accent}" stroke="{foreground}" stroke-width="8"/>
<path d="M91 125c18-21 56-27 79-8" fill="none" stroke="{highlight}" stroke-width="10" stroke-linecap="round"/>
<path d="M128 79c-5-18 5-27 19-30" fill="none" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>"""
    if "peppermint" in value:
        return f"""<circle cx="128" cy="128" r="57" fill="{highlight}" stroke="{foreground}" stroke-width="7"/>
<path d="M128 71c28 17 42 37 57 57-15 20-29 40-57 57-28-17-42-37-57-57 15-20 29-40 57-57z" fill="{accent}"/>
<circle cx="128" cy="128" r="17" fill="{highlight}"/>"""
    if "candy apple" in value:
        return f"""<path d="M128 95c-30-28-70-2-58 43 9 35 37 61 58 61s49-26 58-61c12-45-28-71-58-43z" fill="{accent}" stroke="{foreground}" stroke-width="7"/>
<path d="M128 99c-3-21 3-34 16-44" fill="none" stroke="{foreground}" stroke-width="9" stroke-linecap="round"/>
<path d="M143 61c18-12 34-3 35 12-15 8-29 5-35-12z" fill="{highlight}"/>
<ellipse cx="100" cy="122" rx="9" ry="16" fill="{highlight}" opacity=".72"/>"""
    if "pie" in value or "fruitcake" in value or "pudding" in value:
        return f"""<path d="M67 158h122l-15 34H82z" fill="{accent}" stroke="{foreground}" stroke-width="7" stroke-linejoin="round"/>
<path d="M75 155c9-40 29-62 53-62s44 22 53 62z" fill="{highlight}" stroke="{foreground}" stroke-width="7"/>
<path d="M101 123l13 9M141 112l-7 13M157 135l-11 4" stroke="{accent}" stroke-width="7" stroke-linecap="round"/>"""
    if "toffee" in value:
        return f"""<path d="M80 105l36-20 35 20-35 22z" fill="{highlight}" stroke="{foreground}" stroke-width="6" stroke-linejoin="round"/>
<path d="M80 105v43l36 21v-42z" fill="{accent}" stroke="{foreground}" stroke-width="6" stroke-linejoin="round"/>
<path d="M116 127l35-22v43l-35 21z" fill="{foreground}" stroke="{foreground}" stroke-width="6" stroke-linejoin="round"/>
<path d="M72 185h112" stroke="{accent}" stroke-width="8" stroke-linecap="round"/>"""
    return f"""<circle cx="128" cy="132" r="62" fill="{highlight}" stroke="{foreground}" stroke-width="8"/>
<g fill="{accent}"><circle cx="101" cy="111" r="6"/><circle cx="144" cy="106" r="6"/><circle cx="117" cy="144" r="6"/><circle cx="157" cy="145" r="6"/><circle cx="91" cy="151" r="6"/></g>
<path d="M92 186h72" stroke="{accent}" stroke-width="8" stroke-linecap="round"/>"""


def song_icon(name: str, foreground: str, accent: str, highlight: str) -> str:
    value = name.lower()
    if "bell" in value or "jingle" in value or "carol" in value:
        return bell(foreground, accent, highlight)
    if "sleigh" in value:
        return f"""<path d="M61 170h134c-10 19-29 29-60 29H83z" fill="{accent}" stroke="{foreground}" stroke-width="8" stroke-linejoin="round"/>
<path d="M82 187c26 14 74 14 103-2" fill="none" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>
<path d="M91 152c8-28 26-44 51-44 19 0 33 8 43 22-32 19-61 25-94 22z" fill="{foreground}"/>
<circle cx="115" cy="132" r="10" fill="{highlight}"/><circle cx="145" cy="123" r="10" fill="{highlight}"/>"""
    if "deck the halls" in value or "holly jolly" in value:
        return f"""<path d="M68 147c31-70 89-79 121-19" fill="none" stroke="{foreground}" stroke-width="12" stroke-linecap="round"/>
<path d="M83 155c31-51 73-59 94-27" fill="none" stroke="{accent}" stroke-width="8" stroke-linecap="round"/>
<circle cx="85" cy="139" r="10" fill="{highlight}"/><circle cx="128" cy="108" r="10" fill="{highlight}"/><circle cx="175" cy="128" r="10" fill="{highlight}"/>
<path d="M74 182h108" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>"""
    if "all is bright" in value:
        return f"""<path d="M62 88c35 28 97 28 132 0" fill="none" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>
<path d="M77 99v20M103 109v20M128 113v20M153 109v20M179 99v20" stroke="{accent}" stroke-width="5"/>
<circle cx="77" cy="126" r="10" fill="{highlight}"/><circle cx="103" cy="136" r="10" fill="{accent}"/>
<circle cx="128" cy="140" r="10" fill="{highlight}"/><circle cx="153" cy="136" r="10" fill="{accent}"/><circle cx="179" cy="126" r="10" fill="{highlight}"/>"""
    if "wonderland" in value or "let it snow" in value:
        return f"""<path d="M58 179h140" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>
<path d="M80 163l25-36 25 36zM117 163l32-52 32 52z" fill="{accent}" stroke="{foreground}" stroke-width="6" stroke-linejoin="round"/>
<path d="M101 139l4-12 5 12M144 133l5-22 6 22" fill="none" stroke="{highlight}" stroke-width="7"/>
<circle cx="94" cy="91" r="5" fill="{highlight}"/><circle cx="166" cy="82" r="6" fill="{highlight}"/>"""
    if "silent night" in value:
        return f"""<path d="M154 65c-31 5-49 32-41 62 6 23 25 37 49 36-16 17-44 22-66 10-29-16-39-54-23-83 16-29 52-41 81-25z" fill="{highlight}"/>
<path d="M88 173h79" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>
<circle cx="177" cy="90" r="6" fill="{accent}"/><circle cx="191" cy="119" r="4" fill="{accent}"/>"""
    return f"""<path d="M128 63v94" stroke="{foreground}" stroke-width="13" stroke-linecap="round"/>
<path d="M128 65l55-14v78" fill="none" stroke="{foreground}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
<ellipse cx="101" cy="169" rx="25" ry="16" fill="{accent}"/><ellipse cx="156" cy="145" rx="25" ry="16" fill="{accent}"/>
<path d="M82 201h96" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>"""


def svg_art(name: str, foreground: str, accent: str, highlight: str) -> str:
    value = name.lower()
    if value in {"frosty", "snow miser", "snowflake", "snowball"}:
        return snowflake(foreground, accent, highlight)
    if value == "heat miser":
        return f"""<path d="M128 49c4 31-23 42-9 68-22-8-37 16-34 37 3 25 22 43 45 43s43-19 45-44c3-29-17-44-31-64-7-10-13-24-16-40z" fill="{accent}"/>
<path d="M128 112c1 20-16 30-13 47 2 12 7 20 15 20s16-9 16-21c0-15-12-28-18-46z" fill="{highlight}"/>
<circle cx="128" cy="179" r="7" fill="{foreground}"/>"""
    if value == "grinch" or value == "holly" or value == "mistletoe" or value == "holly jolly":
        return f"""<path d="M72 122c-11-25 7-44 31-34 3-27 29-34 43-12 21-16 45-2 38 24 25 8 28 33 5 44 5 24-19 38-39 24-17 20-45 11-45-14-26 2-41-13-33-32z" fill="{foreground}"/>
<circle cx="116" cy="126" r="12" fill="{accent}"/><circle cx="138" cy="116" r="12" fill="{accent}"/><circle cx="142" cy="140" r="12" fill="{accent}"/>
<path d="M128 94l-2-21" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>"""
    if value == "snoopy":
        return f"""<circle cx="128" cy="127" r="65" fill="{highlight}" stroke="{foreground}" stroke-width="7"/>
<circle cx="103" cy="119" r="7" fill="{foreground}"/><circle cx="153" cy="119" r="7" fill="{foreground}"/>
<path d="M100 149c17 19 39 19 56 0" fill="none" stroke="{accent}" stroke-width="8" stroke-linecap="round"/>
<path d="M82 181h92" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>"""
    if value == "rudolph" or value == "reindeer":
        return f"""<path d="M94 118L79 80 61 70M80 82H56M162 118l15-38 18-10M176 82h24" fill="none" stroke="{foreground}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M85 148c0-32 18-51 43-51s43 19 43 51c0 27-18 42-43 42s-43-15-43-42z" fill="{accent}"/>
<circle cx="110" cy="140" r="6" fill="{foreground}"/><circle cx="146" cy="140" r="6" fill="{foreground}"/>
<path d="M114 160c10 9 20 9 29 0" fill="none" stroke="{foreground}" stroke-width="7" stroke-linecap="round"/>
<circle cx="128" cy="151" r="9" fill="{highlight}"/>"""
    if value == "charlie brown":
        return f"""<path d="M128 52l19 52 55 2-43 34 15 53-46-31-46 31 15-53-43-34 55-2z" fill="{highlight}" stroke="{foreground}" stroke-width="7" stroke-linejoin="round"/>
<circle cx="128" cy="127" r="14" fill="{accent}"/>"""
    if value == "muppet":
        return bell(foreground, accent, highlight)
    if value == "whoville":
        return f"""<path d="M48 186h160" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>
<path d="M62 149h47v37H62zM116 121h55v65h-55zM177 154h26v32h-26z" fill="{accent}"/>
<path d="M57 149l29-30 29 30M110 121l33-35 34 35M172 154l18-21 18 21" fill="{highlight}"/>
<path d="M76 160h10v13H76zM136 141h12v15h-12zM155 141h9v15h-9z" fill="{foreground}"/>"""
    if value == "polar express":
        return f"""<path d="M50 183h156" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>
<path d="M69 118h88l22 27v33H69z" fill="{accent}" stroke="{foreground}" stroke-width="7" stroke-linejoin="round"/>
<path d="M139 118V85h18v33M134 80h28v9h-28z" fill="{foreground}"/>
<path d="M84 130h22v20H84zM116 130h20v20h-20z" fill="{highlight}"/>
<circle cx="92" cy="178" r="15" fill="{foreground}"/><circle cx="151" cy="178" r="15" fill="{foreground}"/>
<circle cx="92" cy="178" r="6" fill="{highlight}"/><circle cx="151" cy="178" r="6" fill="{highlight}"/>"""
    if value == "nutcracker":
        return f"""<path d="M82 115c0-26 20-45 46-45s46 19 46 45v45c0 24-20 39-46 39s-46-15-46-39z" fill="{accent}" stroke="{foreground}" stroke-width="7"/>
<path d="M76 110h104M90 148h76M101 172h54" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>
<circle cx="111" cy="122" r="6" fill="{foreground}"/><circle cx="145" cy="122" r="6" fill="{foreground}"/>
<path d="M106 91h44" stroke="{foreground}" stroke-width="10" stroke-linecap="round"/>"""
    if value == "kringle":
        return f"""<path d="M76 160c11-47 34-70 58-70s47 23 58 70z" fill="{accent}" stroke="{foreground}" stroke-width="7" stroke-linejoin="round"/>
<rect x="77" y="160" width="115" height="24" rx="12" fill="{highlight}" stroke="{foreground}" stroke-width="7"/>
<circle cx="140" cy="83" r="12" fill="{highlight}" stroke="{foreground}" stroke-width="5"/>"""
    if value == "sugarplum":
        return f"""<path d="M128 74c-31-26-63 2-48 37 12 27 33 48 48 57 15-9 36-30 48-57 15-35-17-63-48-37z" fill="{accent}" stroke="{foreground}" stroke-width="7"/>
<path d="M128 75c-5-18 5-28 20-33" fill="none" stroke="{foreground}" stroke-width="8" stroke-linecap="round"/>
<path d="M147 44c17-7 30 3 30 16-16 5-27-1-30-16z" fill="{highlight}"/>"""
    if value == "north star" or value == "twinkle" or value == "tinsel":
        return star(highlight, outer=70, inner=31)
    if value == "evergreen":
        return f"""<path d="M128 51l-35 47h22l-35 44h30l-39 49h114l-39-49h30l-35-44h22z" fill="{foreground}"/>
<path d="M119 191h18v26h-18z" fill="{accent}"/>
<circle cx="129" cy="91" r="7" fill="{highlight}"/><circle cx="105" cy="139" r="7" fill="{accent}"/><circle cx="151" cy="155" r="7" fill="{highlight}"/>"""
    if value == "yule":
        return f"""<path d="M88 91h80v92H88z" fill="{accent}" stroke="{foreground}" stroke-width="7"/>
<path d="M101 91V75h54v16" fill="{highlight}" stroke="{foreground}" stroke-width="6"/>
<path d="M112 125h32M128 109v33" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>
<path d="M104 196h48" stroke="{foreground}" stroke-width="7" stroke-linecap="round"/>"""
    if value in {"jingle", "silver bells", "jingle bells", "carol bells"}:
        return bell(foreground, accent, highlight)
    if value == "mistletoe":
        return f"""<path d="M128 85c-25-37-64-18-49 14 13 27 39 26 49 12 10 14 36 15 49-12 15-32-24-51-49-14z" fill="{foreground}"/>
<path d="M128 89v79" stroke="{highlight}" stroke-width="8" stroke-linecap="round"/>
<circle cx="114" cy="170" r="13" fill="{accent}"/><circle cx="139" cy="183" r="13" fill="{accent}"/><circle cx="151" cy="162" r="13" fill="{accent}"/>"""
    if value == "candy apple":
        return food_icon(name, foreground, accent, highlight)
    if value == "candy cane":
        return food_icon(name, foreground, accent, highlight)
    if value == "gingerbread":
        return food_icon("Ginger Snap", foreground, accent, highlight)
    if re.search(r"candy|gingerbread|peppermint|sugar|figgy|cranberry|chestnut|eggnog|fruitcake|cookie|apple|mince|pie|cocoa|cinnamon|toffee|bark", value):
        return food_icon(name, foreground, accent, highlight)
    if re.search(r"jingle|silent night|sleigh ride|carol|deck the halls|wonderland|silver bells|let it snow|all is bright", value):
        return song_icon(name, foreground, accent, highlight)
    return snowflake(foreground, accent, highlight)


def svg_for(name: str) -> str:
    background, foreground, accent, highlight = colors_for(name)
    artwork = svg_art(name, foreground, accent, highlight)
    title = escape(f"Original Christmas avatar for {name}")
    decoration_left = 40 + (len(name) * 7) % 25
    decoration_right = 193 + (len(name) * 3) % 20
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title">
  <title id="title">{title}</title>
  <circle cx="128" cy="128" r="124" fill="{background}"/>
  <circle cx="128" cy="128" r="120" fill="none" stroke="{foreground}" stroke-opacity=".22" stroke-width="4"/>
  <path d="M{decoration_left} 42l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill="{highlight}"/>
  <path d="M{decoration_right} 48l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="{accent}"/>
  {artwork}
</svg>
"""


def main() -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    codenames = load_codenames()
    generated_slugs = {slugify(name) for name in codenames}
    for codename in codenames:
        (OUTPUT / f"{slugify(codename)}.svg").write_text(svg_for(codename), encoding="utf-8")
    (OUTPUT / "default.svg").write_text(svg_for("Snowflake"), encoding="utf-8")

    for slug in generated_slugs | {"default"}:
        png_path = OUTPUT / f"{slug}.png"
        if png_path.exists():
            png_path.unlink()
    print(f"Generated {len(codenames)} SVG codename avatars in {OUTPUT}")


if __name__ == "__main__":
    main()
