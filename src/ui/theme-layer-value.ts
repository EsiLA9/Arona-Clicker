export type GradientFunction = 'linear' | 'radial' | 'repeating-linear' | 'repeating-radial';

export interface GradientStop {
  color: string;
  position?: string;
}

export interface ParsedGradient {
  type: GradientFunction;
  direction?: string;
  shape?: string;
  size?: string;
  centerX?: string;
  centerY?: string;
  stops: GradientStop[];
}

const GRADIENT_RE = /^(linear-gradient|radial-gradient|repeating-linear-gradient|repeating-radial-gradient)\((.*)\)$/i;
const COLOR_RE = /^(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\([^)]*\)|var\(--[a-z0-9-]+\)|transparent)$/i;

function splitTopLevel(value: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === '(') depth += 1;
    else if (value[index] === ')') depth = Math.max(0, depth - 1);
    else if (value[index] === ',' && depth === 0) {
      parts.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

function parseStop(value: string): GradientStop | undefined {
  const match = /^(.*?)(?:\s+((?:-?\d+(?:\.\d+)?)(?:%|px|em|rem)?))?$/.exec(value.trim());
  if (!match || !COLOR_RE.test(match[1].trim())) return undefined;
  return { color: match[1].trim(), ...(match[2] ? { position: match[2] } : {}) };
}

export function parseGradient(value: string): ParsedGradient | undefined {
  const match = GRADIENT_RE.exec(value.trim());
  if (!match) return undefined;
  const functionName = match[1].toLowerCase() as `${'linear' | 'radial' | 'repeating-linear' | 'repeating-radial'}-gradient`;
  const type = functionName.replace('-gradient', '') as GradientFunction;
  const parts = splitTopLevel(match[2]);
  if (parts.length < 2) return undefined;
  const first = parts[0];
  const hasDirection = !parseStop(first);
  const stops = (hasDirection ? parts.slice(1) : parts).map(parseStop);
  if (stops.some(stop => !stop)) return undefined;
  if (type === 'linear' || type === 'repeating-linear') return { type, ...(hasDirection ? { direction: first } : {}), stops: stops as GradientStop[] };
  const atIndex = first.toLowerCase().indexOf(' at ');
  const descriptor = atIndex >= 0 ? first.slice(0, atIndex).trim() : first.trim();
  const center = atIndex >= 0 ? first.slice(atIndex + 4).trim().split(/\s+/) : [];
  const shapeMatch = /^(circle|ellipse)(?:\s+|$)/i.exec(descriptor);
  const shape = shapeMatch?.[1];
  const size = descriptor.replace(/^(circle|ellipse)\s*/i, '').trim();
  if (atIndex < 0 && !shape && COLOR_RE.test(descriptor)) return { type, stops: stops as GradientStop[] };
  if (atIndex < 0 && !shape && !size) return undefined;
  return {
    type,
    shape,
    size: size || undefined,
    centerX: center[0],
    centerY: center[1],
    stops: stops as GradientStop[],
  };
}

export function serializeGradient(value: ParsedGradient): string {
  const name = `${value.type}-gradient`;
  const prefix = value.type === 'linear' || value.type === 'repeating-linear'
    ? value.direction
    : [value.shape, value.size, value.centerX && value.centerY ? `at ${value.centerX} ${value.centerY}` : undefined].filter(Boolean).join(' ') || undefined;
  const stops = value.stops.map(stop => [stop.color, stop.position].filter(Boolean).join(' ')).join(', ');
  return `${name}(${prefix ? `${prefix}, ` : ''}${stops})`;
}

export function updateGradient(value: string, update: Partial<ParsedGradient> & { startColor?: string; endColor?: string; stopIndex?: number; stopColor?: string; stopPosition?: string }): string {
  const parsed = parseGradient(value);
  if (!parsed) return value;
  const stops = parsed.stops.map(stop => ({ ...stop }));
  if (update.startColor && stops[0]) stops[0].color = update.startColor;
  if (update.endColor && stops[stops.length - 1]) stops[stops.length - 1].color = update.endColor;
  if (typeof update.stopIndex === 'number' && stops[update.stopIndex]) {
    if (update.stopColor !== undefined) stops[update.stopIndex].color = update.stopColor;
    if (update.stopPosition !== undefined) stops[update.stopIndex].position = update.stopPosition || undefined;
  }
  return serializeGradient({ ...parsed, ...update, stops });
}
