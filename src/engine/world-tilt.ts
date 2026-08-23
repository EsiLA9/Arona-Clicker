export const WORLD_TILT_TAIL_DIGITS = 15;

const DEFAULT_WORLD_TILT = '1.000000000000000';

/** 规范化为「首.尾15」定宽字符串：首位 0|1，尾数不足补 0。缺省 = 官方世界 1.0。 */
export function normalizeWorldTilt(raw: string | number | undefined): string {
  if (raw === undefined) return DEFAULT_WORLD_TILT;
  let text = String(raw).trim().toLowerCase();
  if (text.includes('e')) text = expandExponent(text);
  const match = /^([01])(?:\.(\d*))?$/.exec(text);
  if (!match) {
    throw new Error(`worldTilt 格式应为「首位(0或1).尾数」，收到："${raw}"`);
  }
  const [, head, tailRaw = ''] = match;
  if (tailRaw.length > WORLD_TILT_TAIL_DIGITS) {
    throw new Error(`worldTilt 尾数最多 ${WORLD_TILT_TAIL_DIGITS} 位，收到："${raw}"`);
  }
  return `${head}.${tailRaw.padEnd(WORLD_TILT_TAIL_DIGITS, '0')}`;
}

function expandExponent(text: string): string {
  const [mantissa, exponent] = text.split('e');
  const exp = Number(exponent);
  if (!Number.isInteger(exp)) {
    throw new Error(`worldTilt 指数非法："${text}"`);
  }
  const dot = mantissa.indexOf('.');
  const digits = mantissa.replace('.', '');
  const point = (dot === -1 ? mantissa.length : dot) + exp;
  if (point <= 0) return `0.${'0'.repeat(-point)}${digits}`;
  if (point >= digits.length) return `${digits}${'0'.repeat(point - digits.length)}.`;
  return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

/** 定宽规范化串可直接按字典序比较（首位等长、尾数固定 15 位）。返回升序差。 */
export function compareWorldTilt(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
