import type { CompositionType } from '../data-services/contracts/color';

export function avatarColorCount(pattern: CompositionType, provided = 0): number {
  switch (pattern) {
    case 'solid': return 1;
    case 'gradient': return 2;
    case 'duotone': return 2;
    case 'radial': return 2;
    case 'pie': return Math.max(1, provided);
  }
}

export function resolveAvatarColors(pattern: CompositionType, colors: string[]): string[] {
  const count = avatarColorCount(pattern, colors.length);
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(colors[i] ?? '#888888');
  return out;
}

let gradientSeq = 0;

function pieSector(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const a0 = (startDeg * Math.PI) / 180;
  const a1 = (endDeg * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${cx.toFixed(2)} ${cy.toFixed(2)} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

export function renderAvatarSvg(pattern: CompositionType, colors: string[], size = 64): string {
  const s = Math.max(1, Math.floor(size));
  const palette = resolveAvatarColors(pattern, colors);
  const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 64 64" role="img">`;
  const tail = '</svg>';
  switch (pattern) {
    case 'solid': return `${head}<circle cx="32" cy="32" r="30" fill="${palette[0]}"/>${tail}`;
    case 'gradient': {
      const id = `av-grad-${gradientSeq++}`;
      return `${head}<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></linearGradient></defs><circle cx="32" cy="32" r="30" fill="url(#${id})"/>${tail}`;
    }
    case 'duotone': return `${head}<circle cx="32" cy="32" r="30" fill="${palette[0]}"/><ellipse cx="32" cy="51" rx="27" ry="15" fill="${palette[1]}" opacity="0.5"/>${tail}`;
    case 'pie': {
      const n = palette.length;
      const step = 360 / n;
      const sectors = palette.map((c, i) => `<path d="${pieSector(32, 32, 30, i * step, (i + 1) * step)}" fill="${c}"/>`).join('');
      return `${head}<circle cx="32" cy="32" r="30" fill="#ffffff"/>${sectors}${tail}`;
    }
    case 'radial': {
      const id = `av-radial-${gradientSeq++}`;
      return `${head}<defs><radialGradient id="${id}" cx="0.35" cy="0.35" r="0.9"><stop offset="0" stop-color="${palette[0]}"/><stop offset="1" stop-color="${palette[1]}"/></radialGradient></defs><circle cx="32" cy="32" r="30" fill="url(#${id})"/>${tail}`;
    }
  }
}
