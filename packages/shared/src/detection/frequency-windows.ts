// Single source of truth for cadence/frequency windows used by ALL detection
// across the app: FixedCost detection, StandingOrder frequency derivation, and
// the import-time recurring suggester.
//
// A window is the [minDays, maxDays] tolerance band around the canonical
// gap-in-days for a frequency. Windows are deliberately tight enough that they
// don't overlap (no booking can match two windows) but wide enough to absorb
// month-length variance and bank processing delays.

export type DetectedFrequency =
  | 'WEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'YEARLY'
  | 'CUSTOM';

export interface FrequencyWindow {
  freq: Exclude<DetectedFrequency, 'CUSTOM'>;
  /** Inclusive lower bound, in days. */
  minDays: number;
  /** Inclusive upper bound, in days. */
  maxDays: number;
  /** Canonical gap used for next-occurrence prediction. */
  canonicalDays: number;
}

export const FREQUENCY_WINDOWS: readonly FrequencyWindow[] = [
  { freq: 'WEEKLY',      minDays:   6, maxDays:   8, canonicalDays:   7 },
  { freq: 'MONTHLY',     minDays:  27, maxDays:  32, canonicalDays:  30 },
  { freq: 'QUARTERLY',   minDays:  85, maxDays:  95, canonicalDays:  91 },
  { freq: 'HALF_YEARLY', minDays: 170, maxDays: 195, canonicalDays: 182 },
  { freq: 'YEARLY',      minDays: 350, maxDays: 380, canonicalDays: 365 },
];

/**
 * Classifies a single day-gap into a frequency, or CUSTOM when no window
 * matches. Used to label a median delta. For "do all gaps fit one window?",
 * use {@link allGapsFitWindow}.
 */
export function classifyByDays(days: number): DetectedFrequency {
  for (const w of FREQUENCY_WINDOWS) {
    if (days >= w.minDays && days <= w.maxDays) return w.freq;
  }
  return 'CUSTOM';
}

/**
 * Returns the first window where EVERY gap in `gaps` fits inside
 * [minDays, maxDays]. Used by StandingOrders / strict-mode classification
 * where any outlier should fall back to CUSTOM.
 */
export function allGapsFitWindow(gaps: readonly number[]): DetectedFrequency {
  if (gaps.length === 0) return 'CUSTOM';
  for (const w of FREQUENCY_WINDOWS) {
    if (gaps.every(g => g >= w.minDays && g <= w.maxDays)) return w.freq;
  }
  return 'CUSTOM';
}

/** Canonical gap-in-days for a frequency, used to predict the next renewal. */
export function canonicalDaysFor(freq: DetectedFrequency): number {
  if (freq === 'CUSTOM') return 0;
  return FREQUENCY_WINDOWS.find(w => w.freq === freq)!.canonicalDays;
}
