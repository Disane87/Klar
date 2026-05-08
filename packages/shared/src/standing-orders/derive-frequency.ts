export type DerivedFrequency =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'CUSTOM'
  | 'UNKNOWN';

interface FrequencyWindow {
  freq: Exclude<DerivedFrequency, 'CUSTOM' | 'UNKNOWN'>;
  minDays: number;
  maxDays: number;
}

const WINDOWS: FrequencyWindow[] = [
  { freq: 'WEEKLY', minDays: 6, maxDays: 8 },
  { freq: 'MONTHLY', minDays: 27, maxDays: 32 },
  { freq: 'QUARTERLY', minDays: 88, maxDays: 93 },
  { freq: 'HALF_YEARLY', minDays: 178, maxDays: 184 },
  { freq: 'YEARLY', minDays: 360, maxDays: 370 },
];

/**
 * Infers the cadence of a recurring booking from a list of ISO dates.
 * Returns the first window whose [minDays, maxDays] tolerance contains
 * EVERY consecutive gap. Falls back to CUSTOM when gaps mix incompatibly,
 * and UNKNOWN when fewer than 2 dates are supplied.
 */
export function deriveFrequency(isoDates: readonly string[]): DerivedFrequency {
  if (isoDates.length < 2) return 'UNKNOWN';

  const sorted = [...isoDates].sort();
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    gaps.push(daysBetween(sorted[i - 1], sorted[i]));
  }

  for (const w of WINDOWS) {
    if (gaps.every(g => g >= w.minDays && g <= w.maxDays)) {
      return w.freq;
    }
  }
  return 'CUSTOM';
}

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.UTC(
    Number(aIso.slice(0, 4)),
    Number(aIso.slice(5, 7)) - 1,
    Number(aIso.slice(8, 10)),
  );
  const b = Date.UTC(
    Number(bIso.slice(0, 4)),
    Number(bIso.slice(5, 7)) - 1,
    Number(bIso.slice(8, 10)),
  );
  return Math.round((b - a) / 86_400_000);
}
