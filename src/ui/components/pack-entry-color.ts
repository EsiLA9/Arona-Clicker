import type { PackManifestColor } from '../../data-services/datapack/manifest';

type RGB = readonly [number, number, number];

function hslToRgb(hue: number, saturation: number, lightness: number): RGB {
  const h = ((hue % 360) + 360) % 360 / 360;
  const s = saturation / 100;
  const l = lightness / 100;
  if (s === 0) {
    const channel = Math.round(l * 255);
    return [channel, channel, channel];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (offset: number): number => {
    let t = offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    const value = t < 1 / 6 ? p + (q - p) * 6 * t
      : t < 1 / 2 ? q
        : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6
          : p;
    return Math.round(value * 255);
  };
  return [channel(h + 1 / 3), channel(h), channel(h - 1 / 3)];
}

function fallbackColor(modName: string): RGB {
  let hash = 2166136261;
  for (const character of modName) hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  const hue = (hash >>> 0) % 360;
  return hslToRgb(hue, 54 + ((hash >>> 9) % 9), 84 + ((hash >>> 17) % 7));
}

function luminance([red, green, blue]: RGB): number {
  const linear = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue);
}

function contrast(background: number, foreground: number): number {
  const [lighter, darker] = background >= foreground ? [background, foreground] : [foreground, background];
  return (lighter + 0.05) / (darker + 0.05);
}

export function packEntryColorStyle(modName: string, color?: PackManifestColor): string {
  const rgb: RGB = color
    ? 'r' in color
      ? [color.r, color.g, color.b]
      : hslToRgb(color.h, color.s, color.l)
    : fallbackColor(modName);
  const backgroundLuminance = luminance(rgb);
  const dark = [16, 24, 36] as const;
  const foreground = contrast(backgroundLuminance, 1) >= contrast(backgroundLuminance, luminance(dark)) ? '#ffffff' : '#101824';
  return `--pack-entry-bg: rgb(${rgb.join(' ')}); --pack-entry-fg: ${foreground};`;
}
