import { getRetainerEntitlements, type RetainerTier } from "./entitlements";

export const RETAINER_STOCK_LOGOS = Array.from({ length: 8 }, (_, idx) => {
  const n = String(idx + 1).padStart(2, "0");
  return `/stock/logos/retainer-${n}.svg`;
});

const RETAINER_TIER_FLAGS: Record<RetainerTier, { color: string; label: string }> = {
  STARTER: { color: "#38bdf8", label: "S" },
  GROWTH: { color: "#22c55e", label: "G" },
  ENTERPRISE: { color: "#f59e0b", label: "E" },
};

function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash >>> 0);
}

function pick<T>(arr: readonly T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

function toDataSvg(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function getSeekerStickFigureAvatar(id?: string | null): string {
  const seed = hashString(id && String(id).trim() ? String(id).trim() : "default");

  const bg = pick(
    [
      ["#0ea5e9", "#22c55e"],
      ["#a855f7", "#f97316"],
      ["#14b8a6", "#6366f1"],
      ["#fb7185", "#3b82f6"],
      ["#eab308", "#ec4899"],
      ["#06b6d4", "#a3e635"],
    ] as const,
    seed,
    0
  );

  const skin = pick(
    ["#f1d1b5", "#e7be98", "#d9a577", "#c6865a", "#a86b46", "#7a4a33"] as const,
    seed,
    3
  );

  const shirt = pick(
    ["#0f172a", "#111827", "#1f2937", "#334155", "#0b1220"] as const,
    seed,
    5
  );

  const accent = pick(
    ["#22c55e", "#38bdf8", "#a855f7", "#fb7185", "#f97316", "#eab308"] as const,
    seed,
    7
  );

  const hasGlasses = seed % 3 === 0;
  const hasHat = seed % 5 === 0;
  const pose = seed % 4; // 0..3
  const hair = seed % 6; // 0..5

  const arms =
    pose === 0
      ? // relaxed
        `<path d="M226 290 L196 338" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
         <path d="M286 290 L316 338" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>`
      : pose === 1
        ? // wave
          `<path d="M226 290 L192 318" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
           <path d="M286 290 L336 264" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>`
        : pose === 2
          ? // hands on hips
            `<path d="M226 298 L204 308" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
             <path d="M286 298 L308 308" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>`
          : // arms up
            `<path d="M226 286 L196 252" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
             <path d="M286 286 L316 252" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>`;

  const hairSvg =
    hair === 0
      ? ""
      : hair === 1
        ? `<path d="M216 190 C230 160 282 160 296 190" fill="none" stroke="#0b1220" stroke-width="16" stroke-linecap="round"/>`
        : hair === 2
          ? `<path d="M212 196 C228 166 284 166 300 196" fill="#0b1220"/>`
          : hair === 3
            ? `<path d="M210 198 C240 160 272 160 302 198" fill="none" stroke="#0b1220" stroke-width="18" stroke-linecap="round"/>`
            : hair === 4
              ? `<path d="M212 194 C240 162 272 162 300 194" fill="none" stroke="#0b1220" stroke-width="18" stroke-linecap="round"/>
                 <path d="M236 182 C242 168 270 168 276 182" fill="none" stroke="#0b1220" stroke-width="10" stroke-linecap="round"/>`
              : `<path d="M214 196 C236 164 276 164 298 196" fill="none" stroke="#0b1220" stroke-width="18" stroke-linecap="round"/>
                 <circle cx="214" cy="198" r="6" fill="#0b1220"/>
                 <circle cx="298" cy="198" r="6" fill="#0b1220"/>`;

  const glassesSvg = hasGlasses
    ? `<rect x="214" y="214" width="40" height="26" rx="10" fill="none" stroke="#0b1220" stroke-width="6"/>
       <rect x="258" y="214" width="40" height="26" rx="10" fill="none" stroke="#0b1220" stroke-width="6"/>
       <path d="M254 226 L258 226" stroke="#0b1220" stroke-width="6" stroke-linecap="round"/>`
    : "";

  const hatSvg = hasHat
    ? `<path d="M204 198 C234 166 278 166 308 198" fill="#0b1220"/>
       <path d="M192 206 H320" stroke="#0b1220" stroke-width="18" stroke-linecap="round"/>`
    : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg[0]}"/>
      <stop offset="1" stop-color="${bg[1]}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="200" fill="rgba(2,6,23,0.18)"/>
  <circle cx="256" cy="236" r="68" fill="${skin}"/>
  ${hairSvg}
  ${hatSvg}
  ${glassesSvg}
  <path d="M240 250 C246 258 266 258 272 250" fill="none" stroke="#0b1220" stroke-width="8" stroke-linecap="round"/>
  <circle cx="236" cy="232" r="6" fill="#0b1220"/>
  <circle cx="276" cy="232" r="6" fill="#0b1220"/>
  <path d="M224 300 Q256 286 288 300 Q306 354 290 410 Q256 432 222 410 Q206 354 224 300 Z" fill="${shirt}" opacity="0.92"/>
  ${arms}
  <path d="M248 404 L232 456" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
  <path d="M264 404 L280 456" stroke="${accent}" stroke-width="14" stroke-linecap="round"/>
</svg>`;

  return toDataSvg(svg);
}

export function getRetainerTierAvatar(id?: string | null): string {
  const key = id && String(id).trim() ? String(id).trim() : "default";
  const seed = hashString(key);
  const tier =
    id && String(id).trim()
      ? getRetainerEntitlements(String(id)).tier
      : "STARTER";
  const flag = RETAINER_TIER_FLAGS[tier] || RETAINER_TIER_FLAGS.STARTER;

  const bg = pick(
    [
      ["#0ea5e9", "#1d4ed8"],
      ["#22c55e", "#0f766e"],
      ["#a855f7", "#f97316"],
      ["#14b8a6", "#2563eb"],
      ["#fb7185", "#7c3aed"],
      ["#eab308", "#f97316"],
    ] as const,
    seed,
    2
  );

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg[0]}"/>
      <stop offset="1" stop-color="${bg[1]}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <rect x="138" y="168" width="236" height="240" rx="24" fill="rgba(255,255,255,0.92)"/>
  <rect x="178" y="210" width="40" height="40" rx="8" fill="rgba(15,23,42,0.18)"/>
  <rect x="238" y="210" width="40" height="40" rx="8" fill="rgba(15,23,42,0.18)"/>
  <rect x="298" y="210" width="40" height="40" rx="8" fill="rgba(15,23,42,0.18)"/>
  <rect x="238" y="278" width="40" height="130" rx="10" fill="rgba(15,23,42,0.18)"/>
  <rect x="360" y="120" width="10" height="90" rx="5" fill="rgba(15,23,42,0.65)"/>
  <path d="M370 130 H436 L412 150 L436 170 H370 Z" fill="${flag.color}" stroke="rgba(15,23,42,0.25)" stroke-width="3"/>
  <text x="402" y="156" text-anchor="middle" font-size="22" font-family="ui-sans-serif, system-ui" font-weight="700" fill="#0f172a">${flag.label}</text>
</svg>`;

  return toDataSvg(svg);
}

export function getStockImageUrl(
  kind: "SEEKER" | "RETAINER",
  id?: string | null
): string {
  if (kind === "SEEKER") return getSeekerStickFigureAvatar(id);
  return getRetainerTierAvatar(id);
}
