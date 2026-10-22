import { z } from 'zod';

/** A number in [0, 1), drawn for each fault. */
export type Random = () => number;

/**
 * A seeded generator (mulberry32): the same seed gives the same draws, so a
 * run with injected faults can be repeated exactly. Not for secrets: only
 * for choosing which request fails.
 */
export function seededRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const rate = z.number().min(0).max(1);
const millis = z.number().int().min(0).max(60_000);

const FaultProfileSchema = z.strictObject({
  /** Extra wait before each answer. */
  latencyMs: millis.default(0),
  /** Share of requests answered with a server error. */
  errorRate: rate.default(0),
  /** Share of requests whose answer never comes in time. */
  timeoutRate: rate.default(0),
  /** Share of payments the payee's bank rejects. */
  rejectRate: rate.default(0),
  /** Share of webhooks never delivered. */
  webhookLossRate: rate.default(0),
  /** Share of webhooks delivered twice, with the same event id. */
  webhookDuplicateRate: rate.default(0),
  /** Wait before a webhook is due. */
  webhookDelayMs: millis.default(0),
});

export type FaultProfile = z.infer<typeof FaultProfileSchema>;

export const NO_FAULTS: FaultProfile = FaultProfileSchema.parse({});

/** Reads the profile of SIMULATOR_FAULTS; none when it is not set. */
export function parseFaultProfile(raw: string | undefined): FaultProfile {
  if (raw === undefined || raw.trim() === '') return NO_FAULTS;
  return FaultProfileSchema.parse(JSON.parse(raw));
}

/** What goes wrong with a request, if anything. */
export type RequestFault = 'ERROR' | 'TIMEOUT';

/** Draws the faults of a profile (v1.2.0 plan, D5), one draw per decision. */
export class Faults {
  readonly #profile: FaultProfile;
  readonly #random: Random;

  constructor(profile: FaultProfile, random: Random) {
    this.#profile = profile;
    this.#random = random;
  }

  get profile(): FaultProfile {
    return this.#profile;
  }

  /** A server error, an answer that never comes in time, or none. */
  requestFault(): RequestFault | null {
    const draw = this.#random();
    if (draw < this.#profile.errorRate) return 'ERROR';
    if (draw < this.#profile.errorRate + this.#profile.timeoutRate) return 'TIMEOUT';
    return null;
  }

  /** Whether the payee's bank rejects this payment. */
  rejects(): boolean {
    return this.#random() < this.#profile.rejectRate;
  }

  /** How many times a webhook is delivered: 0 (lost), 1, or 2 (duplicated). */
  webhookDeliveries(): 0 | 1 | 2 {
    if (this.#random() < this.#profile.webhookLossRate) return 0;
    return this.#random() < this.#profile.webhookDuplicateRate ? 2 : 1;
  }
}
