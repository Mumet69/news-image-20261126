// news-image-20261126 — a program that draws a newspaper front page summing up
// Thursday 26 November 2026's world news and writes it to entry.png.
// Node 22 stdlib only (fs, zlib, path). No network, no files read, no clock,
// no randomness: every run writes the same bytes.

import * as fs from "node:fs";
import * as zlib from "node:zlib";
import * as path from "node:path";

const W = 1024;
const H = 1024;

// ---- palette ----
const PAPER: C = [246, 241, 229];
const INK: C = [20, 20, 20];
const NAVY: C = [22, 50, 79];
const RED: C = [179, 38, 30];
const ORANGE: C = [232, 100, 27];
const YELLOW: C = [242, 183, 5];
const SKY: C = [191, 217, 232];
const SKY2: C = [158, 196, 220];
const GRAY: C = [107, 107, 107];
const LGRAY: C = [210, 205, 190];
const WHITE: C = [255, 255, 255];
const GREEN: C = [74, 102, 66];
const GOLD: C = [176, 141, 58];

type C = [number, number, number];

// ---- canvas ----
const img = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  img[i * 3] = PAPER[0];
  img[i * 3 + 1] = PAPER[1];
  img[i * 3 + 2] = PAPER[2];
}

function px(x: number, y: number, c: C): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 3;
  img[o] = c[0];
  img[o + 1] = c[1];
  img[o + 2] = c[2];
}

function rect(x: number, y: number, w: number, h: number, c: C): void {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) px(i, j, c);
}

function hline(x: number, y: number, w: number, t: number, c: C): void {
  rect(x, y, w, t, c);
}

function circle(cx: number, cy: number, r: number, c: C): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    for (let i = -dx; i <= dx; i++) px(cx + i, cy + dy, c);
  }
}

// Filled triangle (scanline).
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: C): void {
  const minY = Math.max(0, Math.min(y0, y1, y2));
  const maxY = Math.min(H - 1, Math.max(y0, y1, y2));
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    const edges: [number, number, number, number][] = [
      [x0, y0, x1, y1],
      [x1, y1, x2, y2],
      [x2, y2, x0, y0],
    ];
    for (const [ax, ay, bx, by] of edges) {
      if ((ay <= y && by > y) || (by <= y && ay > y)) {
        xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
      }
    }
    if (xs.length < 2) continue;
    const a = Math.max(0, Math.floor(Math.min(...xs)));
    const b = Math.min(W - 1, Math.ceil(Math.max(...xs)));
    for (let x = a; x <= b; x++) px(x, y, c);
  }
}

// ---- 5x7 bitmap font (rows are 5-bit strings, "1" = ink) ----
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01111", "10000", "10000", "10111", "10001", "10001", "01110"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
  J: ["00111", "00001", "00001", "00001", "00001", "10001", "01110"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "11001", "10101", "10011", "10011", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10011", "10101", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10001", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "00100", "00100", "00100"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "01100", "01000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "01100", "01000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "(": ["00011", "00100", "01000", "01000", "01000", "00100", "00011"],
  ")": ["11000", "00100", "00010", "00010", "00010", "00100", "11000"],
  "/": ["00001", "00001", "00010", "00100", "01000", "10000", "10000"],
  "&": ["01110", "10001", "10001", "01010", "10100", "10010", "01101"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "@": ["01110", "10001", "10111", "10101", "10111", "10000", "01110"],
  "|": ["00100", "00100", "00100", "00100", "00100", "00100", "00100"],
};

function textWidth(s: string, sc: number): number {
  return s.length * 6 * sc - sc;
}

function drawText(x: number, y: number, s: string, sc: number, c: C): void {
  const up = s.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const g = FONT[up[i]] || FONT[" "];
    const ox = x + i * 6 * sc;
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1")
          rect(ox + col * sc, y + r * sc, sc, sc, c);
  }
}

function drawTextCentered(cx: number, y: number, s: string, sc: number, c: C): void {
  drawText(cx - Math.floor(textWidth(s, sc) / 2), y, s, sc, c);
}

// Greedy word wrap; returns lines that fit maxW pixels at scale sc.
function wrap(s: string, maxW: number, sc: number): string[] {
  const words = s.toUpperCase().split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? cur + " " + w : w;
    if (textWidth(next, sc) <= maxW) {
      cur = next;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

function paragraph(x: number, y: number, maxW: number, s: string, sc: number, c: C, lh: number): number {
  const lines = wrap(s, maxW, sc);
  for (let i = 0; i < lines.length; i++) drawText(x, y + i * lh, lines[i], sc, c);
  return y + lines.length * lh;
}

// ---- small illustrations ----

// Explosion burst centred at (cx, cy).
function burst(cx: number, cy: number, r: number): void {
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    const a2 = ((k + 0.5) * Math.PI) / 6;
    const len = k % 2 === 0 ? r : Math.floor(r * 0.55);
    tri(
      cx, cy,
      Math.round(cx + Math.cos(a) * len), Math.round(cy + Math.sin(a) * len),
      Math.round(cx + Math.cos(a2) * len * 0.6), Math.round(cy + Math.sin(a2) * len * 0.6),
      k % 3 === 0 ? YELLOW : ORANGE,
    );
  }
  circle(cx, cy, Math.floor(r * 0.42), YELLOW);
  circle(cx, cy, Math.floor(r * 0.24), WHITE);
}

// Jet silhouette pointing right, nose at (x, y): slim fuselage, nose cone,
// swept wings and a tail fin, so it reads as a jet rather than an arrow.
function jet(x: number, y: number, s: number, c: C): void {
  rect(x - 34 * s, y - 2 * s, 34 * s, 4 * s, c);
  tri(x, y, x - 8 * s, y - 4 * s, x - 8 * s, y + 4 * s, c);
  tri(x - 14 * s, y - 2 * s, x - 24 * s, y - 16 * s, x - 8 * s, y - 2 * s, c);
  tri(x - 14 * s, y + 2 * s, x - 24 * s, y + 16 * s, x - 8 * s, y + 2 * s, c);
  tri(x - 30 * s, y - 2 * s, x - 34 * s, y - 12 * s, x - 26 * s, y - 2 * s, c);
}

// Flame: stacked triangles.
function flame(x: number, y: number, w: number, h: number): void {
  tri(x, y + h, x + Math.floor(w * 0.5), y, x + w, y + h, ORANGE);
  tri(x + Math.floor(w * 0.2), y + h, x + Math.floor(w * 0.5), y + Math.floor(h * 0.35), x + Math.floor(w * 0.8), y + h, YELLOW);
  tri(x + Math.floor(w * 0.35), y + h, x + Math.floor(w * 0.5), y + Math.floor(h * 0.6), x + Math.floor(w * 0.65), y + h, RED);
}

// Bar chart of 7 bars.
function bars(x: number, y: number, w: number, h: number): void {
  const bw = Math.floor(w / 9);
  for (let i = 0; i < 7; i++) {
    const bh = Math.floor(h * (0.35 + i * 0.1));
    rect(x + i * (bw + 4), y + h - bh, bw, bh, i % 2 === 0 ? NAVY : RED);
  }
  hline(x, y + h, w, 3, INK);
}

// Scales of justice.
function scales(x: number, y: number, w: number, h: number): void {
  const cx = x + Math.floor(w / 2);
  rect(cx - 2, y + 6, 4, h - 14, INK);
  rect(x + 8, y + 6, w - 16, 4, INK);
  tri(x + 8, y + 10, x + 34, y + 10, x + 21, y + h - 6, GOLD);
  tri(x + w - 34, y + 10, x + w - 8, y + 10, x + w - 21, y + h - 6, GOLD);
  rect(cx - 14, y + h - 8, 28, 8, INK);
}

// ---- page ----

const MX = 28; // side margin
const RX = W - MX; // right edge

// Outer frame
rect(10, 10, W - 20, 3, INK);
rect(10, H - 13, W - 20, 3, INK);
rect(10, 10, 3, H - 20, INK);
rect(W - 13, 10, 3, H - 20, INK);

// Masthead
rect(MX - 10, 20, W - 2 * (MX - 10), 104, NAVY);
drawTextCentered(W / 2, 30, "THE WORLD", 7, WHITE);
drawTextCentered(W / 2, 88, "THURSDAY, 26 NOVEMBER 2026", 2, WHITE);
drawTextCentered(W / 2, 108, "ONE IMAGE - THE DAY'S NEWS", 1, YELLOW);
hline(MX, 132, RX - MX, 4, RED);

// ---- Lead story: Ukraine airbase strike ----
const LY = 144;
drawText(MX, LY, "WAR IN UKRAINE", 2, RED);
drawText(MX, LY + 22, "UKRAINE HITS", 4, INK);
drawText(MX, LY + 54, "RUSSIAN AIRBASE", 4, INK);
paragraph(MX, LY + 96, 566, "Five jets damaged in a long-range strike east of Moscow.", 2, NAVY, 20);
paragraph(
  MX, LY + 142, 566,
  "Ukrainian forces said they struck the Savasleyka airbase in Russia's Nizhny Novgorod region, damaging three MiG-31 jets and two Su-34 fighter-bombers. Russian strikes on Ukraine's energy grid killed at least five people.",
  1, INK, 12,
);
// Stat box
rect(MX, LY + 196, 566, 40, NAVY);
drawTextCentered(MX + 283, LY + 208, "5 JETS DAMAGED: 3 MIG-31 + 2 SU-34", 2, WHITE);

// Lead illustration: sky, airbase, explosion
const IX = 620, IY = 144, IW = RX - IX, IH = 236;
rect(IX, IY, IW, IH, SKY);
rect(IX, IY, IW, 46, SKY2);
circle(IX + 52, IY + 30, 20, YELLOW);
rect(IX, IY + 168, IW, IH - 168, GREEN);
rect(IX, IY + 196, IW, 10, LGRAY); // runway
rect(IX, IY + 214, IW, 4, WHITE);
jet(IX + 150, IY + 84, 1, INK);
jet(IX + 300, IY + 52, 1, NAVY);
burst(IX + 268, IY + 138, 46);
burst(IX + 190, IY + 158, 24);
circle(IX + 210, IY + 96, 16, GRAY);
circle(IX + 238, IY + 82, 12, GRAY);
rect(IX, IY + IH - 22, IW, 22, INK);
drawTextCentered(IX + Math.floor(IW / 2), IY + IH - 17, "SAVASLEYKA AIRBASE, EAST OF MOSCOW", 1, WHITE);

hline(MX, 396, RX - MX, 2, INK);

// ---- Row 2: three stories ----
const R2Y = 410;
const COLW = 306;
const COLX = [MX, MX + COLW + 8, MX + 2 * (COLW + 8)];

function storyHead(x: number, y: number, kicker: string, lines: string[]): number {
  drawText(x, y, kicker, 1, RED);
  let yy = y + 12;
  for (const ln of lines) {
    drawText(x, yy, ln, 2, INK);
    yy += 16;
  }
  return yy;
}

// Cairo
let y2 = storyHead(COLX[0], R2Y, "EGYPT", ["CAIRO TANKER FIRE", "KILLS 31"]);
flame(COLX[0] + 40, y2 + 4, 220, 62);
paragraph(
  COLX[0], y2 + 74, COLW,
  "A fuel tanker overturned and burst into flames on a Cairo ring road, killing at least 31 people and injuring 21, Egypt's health ministry said.",
  1, INK, 12,
);

// Trump tariffs
y2 = storyHead(COLX[1], R2Y, "UNITED STATES", ["TRUMP UNVEILS", "TARIFFS ON 14 PARTNERS"]);
bars(COLX[1] + 20, y2 + 8, 260, 58);
paragraph(
  COLX[1], y2 + 74, COLW,
  "Washington proposed tariffs on 14 economies, including China, the EU, Japan, South Korea, India and Indonesia.",
  1, INK, 12,
);

// Netanyahu
y2 = storyHead(COLX[2], R2Y, "ISRAEL", ["JUDGES URGE DROP", "OF NETANYAHU CASE"]);
scales(COLX[2] + 90, y2 + 4, 130, 62);
paragraph(
  COLX[2], y2 + 74, COLW,
  "Israeli judges recommended prosecutors drop the Case 4000 bribery case against PM Netanyahu, saying conviction was unlikely.",
  1, INK, 12,
);

hline(MX, 612, RX - MX, 2, INK);

// ---- Row 3: three stories ----
const R3Y = 626;
function story3(x: number, kicker: string, lines: string[], body: string): void {
  drawText(x, R3Y, kicker, 1, RED);
  let yy = R3Y + 12;
  for (const ln of lines) {
    drawText(x, yy, ln, 2, INK);
    yy += 16;
  }
  paragraph(x, yy + 4, COLW, body, 1, INK, 12);
}

story3(COLX[0], "COLOMBIA", ["COLOMBIA FREES", "76 HOSTAGES"],
  "Security forces stormed a supermarket in Cartagena, ending a 17-hour siege and rescuing all 76 hostages.");
story3(COLX[1], "NORTH KOREA", ["NORTH KOREA", "EXPELS SWISS ENVOY"],
  "Pyongyang ordered Switzerland's top diplomat to leave within 48 hours and demanded its newly reopened office close.");
story3(COLX[2], "SPACE", ["FIRST PAKISTANI", "IN ORBIT"],
  "Zeeshan Ali became the first Pakistani in orbit, boarding China's Tiangong station with the Shenzhou-24 crew.");

hline(MX, 800, RX - MX, 2, INK);

// ---- Ticker ----
rect(MX, 814, RX - MX, 88, INK);
drawText(MX + 12, 826, "ALSO TODAY", 2, YELLOW);
paragraph(
  MX + 12, 850, RX - MX - 24,
  "COP31 ends with no deal - 'worst COP ever' | Puerto Rico court cancels Luma power contract | Nigeria seizes $227M meth lab | SpaceX wins OK for 1M satellites",
  1, WHITE, 13,
);

// ---- Footer ----
drawTextCentered(W / 2, 922, "THE WORLD - 26 NOVEMBER 2026", 1, GRAY);
drawTextCentered(W / 2, 940, "SOURCES: REUTERS, AP, AL JAZEERA, BBC, XINHUA", 1, GRAY);
drawTextCentered(W / 2, 966, "DRAWN BY A PROGRAM - NO PHOTOGRAPHS", 1, GRAY);

// ---- PNG encoder (RGB, filter 0, zlib level 9) ----
const CRC_TABLE = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function png(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    img.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "entry.png"), png());
