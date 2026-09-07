/* build-fonts —— 把 D-Web 用到的字型「帶在身上」（展場離線，不得從外網載）
   ----------------------------------------------------------------------------
   Z-Design-System tokens/type.css 三條必遵：字型隨檔打包、中文內嵌、四級真實字重。
   本頁是單檔無 build，所以：

     Chiron Hei HK  從本機某個 repo 的 node_modules/@fontsource/chiron-hei-hk 挑出
                    「Dweb.html 用到的中文」所在分塊，再用 pyftsubset 裁到實際字元，
                    四級字重 400 / 500 / 600 / 700。
     Inter          @fontsource-variable/inter 可變字型 latin + latin-ext 原檔複製。

   用法：node tools/build-fonts.mjs
   需要：Node ≥ 18、Python fonttools + brotli（pip install fonttools brotli）
   改了頁面上的中文之後要重跑，否則新字會掉回系統字（微軟正黑，只有 400/700）。
   ---------------------------------------------------------------------------- */
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const CHIRON = process.env.CHIRON_DIR || "C:/VisTwin/baopu-project/X-Controller/node_modules/@fontsource/chiron-hei-hk";
const INTER  = process.env.INTER_DIR  || "C:/VisTwin/baopu-orb-lab/node_modules/@fontsource-variable/inter";
const PY = process.env.PYTHON || "python";
const WEIGHTS = [400, 500, 600, 700];
const OUT = path.join(ROOT, "fonts");
const FILES = path.join(OUT, "files");

/* 1 · 本頁用到的字：只挑 CJK 與全形（U+2E80 以上、排除 emoji）。
       符號（▶ ◀ ● ○ ↳ …）交給 Inter / 系統字，它們不受字重塌陷影響。 */
const src = fs.readFileSync(path.join(ROOT, "Dweb.html"), "utf8");
const used = new Set([...src].map(c => c.codePointAt(0)).filter(cp => cp >= 0x2E80 && cp < 0x1F000));
console.log(`Dweb.html 用到的 CJK / 全形字元：${used.size}`);

const parseBlocks = css => [...css.matchAll(/@font-face\s*{([^}]*)}/g)].map(m => ({
  file: (m[1].match(/url\(([^)]*\.woff2)\)/) || [])[1],
  ur:   (m[1].match(/unicode-range:\s*([^;]+);/) || [])[1],
}));
const parseRanges = ur => ur.split(",").map(s => s.trim()).map(s => {
  const m = s.match(/U\+([0-9A-F?]+)(?:-([0-9A-F]+))?/i); if (!m) return null;
  if (m[1].includes("?")) return [parseInt(m[1].replace(/\?/g, "0"), 16), parseInt(m[1].replace(/\?/g, "F"), 16)];
  const lo = parseInt(m[1], 16); return [lo, m[2] ? parseInt(m[2], 16) : lo];
}).filter(Boolean);
const toRange = cps => {                       // [1,2,3,7] → "U+0001-0003,U+0007"
  const s = [...cps].sort((a, b) => a - b), out = [];
  for (let i = 0; i < s.length; i++) { let j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    const h = n => n.toString(16).toUpperCase().padStart(4, "0");
    out.push(i === j ? `U+${h(s[i])}` : `U+${h(s[i])}-${h(s[j])}`); i = j; }
  return out.join(",");
};

fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(FILES, { recursive: true });
let css = `/* 由 tools/build-fonts.mjs 產生 —— 不要手改。改了頁面文字要重跑。
   Chiron Hei HK：@fontsource/chiron-hei-hk 分塊 → pyftsubset 裁到本頁字元，四級字重。
   Inter：@fontsource-variable/inter 可變字型 latin + latin-ext。
   授權：皆 SIL OFL 1.1，見 LICENSE-chiron-hei-hk / LICENSE-inter。 */
`;
let bytes = 0, n = 0; const covered = new Set();
for (const w of WEIGHTS) {
  for (const b of parseBlocks(fs.readFileSync(path.join(CHIRON, `${w}.css`), "utf8"))) {
    if (!b.file || !b.ur) continue;
    const ranges = parseRanges(b.ur);
    const hit = [...used].filter(cp => ranges.some(([lo, hi]) => cp >= lo && cp <= hi));
    if (!hit.length) continue;
    hit.forEach(cp => covered.add(cp));
    const name = path.basename(b.file);
    execFileSync(PY, ["-m", "fontTools.subset", path.join(CHIRON, "files", name),
      `--unicodes=${toRange(hit)}`, "--flavor=woff2", "--no-hinting", "--desubroutinize",
      `--output-file=${path.join(FILES, name)}`], { stdio: "pipe" });
    bytes += fs.statSync(path.join(FILES, name)).size; n++;
    css += `@font-face{font-family:"Chiron Hei HK";font-style:normal;font-display:swap;font-weight:${w};src:url(files/${name}) format("woff2");unicode-range:${toRange(hit)};}\n`;
  }
}
for (const b of parseBlocks(fs.readFileSync(path.join(INTER, "index.css"), "utf8"))) {
  if (!b.file) continue; const name = path.basename(b.file);
  if (!/^inter-(latin|latin-ext)-wght-normal\.woff2$/.test(name)) continue;
  fs.copyFileSync(path.join(INTER, "files", name), path.join(FILES, name));
  bytes += fs.statSync(path.join(FILES, name)).size; n++;
  css += `@font-face{font-family:"Inter";font-style:normal;font-display:swap;font-weight:100 900;src:url(files/${name}) format("woff2-variations");unicode-range:${b.ur.replace(/\s+/g, "")};}\n`;
}
fs.writeFileSync(path.join(OUT, "fonts.css"), css);
fs.copyFileSync(path.join(CHIRON, "LICENSE"), path.join(OUT, "LICENSE-chiron-hei-hk"));
fs.copyFileSync(path.join(INTER, "LICENSE"), path.join(OUT, "LICENSE-inter"));
const missing = [...used].filter(cp => !covered.has(cp)).map(cp => `${String.fromCodePoint(cp)}(U+${cp.toString(16).toUpperCase()})`);
console.log(`產出 ${n} 個檔，共 ${(bytes / 1024).toFixed(0)} KB → fonts/`);
if (missing.length) console.log("Chiron 沒涵蓋（會掉系統字）：", missing.join(" "));
