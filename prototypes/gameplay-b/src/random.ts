const ZERO_SEED_FALLBACK = 0x6d2b79f5;

function normalizeSeed(seed: number | string): number {
  if (typeof seed === "number") {
    if (!Number.isFinite(seed)) {
      throw new RangeError("Seed must be a finite number or string.");
    }
    return (Math.trunc(seed) >>> 0) || ZERO_SEED_FALLBACK;
  }

  let hash = 0x811c9dc5;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) || ZERO_SEED_FALLBACK;
}

export class SeededRandom {
  private state: number;
  private draws = 0;

  constructor(readonly seed: number | string) {
    this.state = normalizeSeed(seed);
  }

  get cursor(): number {
    return this.draws;
  }

  nextInt(minInclusive: number, maxInclusive: number): number {
    if (
      !Number.isInteger(minInclusive) ||
      !Number.isInteger(maxInclusive) ||
      maxInclusive < minInclusive
    ) {
      throw new RangeError("Random integer bounds must be ordered integers.");
    }

    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    this.draws += 1;

    const range = maxInclusive - minInclusive + 1;
    return minInclusive + (this.state % range);
  }
}
