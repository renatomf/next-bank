import { z } from 'zod';
import { type FaultProfile, parseFaultProfile } from './base/faults.ts';

// 32 random bytes in base64: the participant's key and the webhook secret.
const key32 = z
  .string()
  .refine((value) => Buffer.from(value, 'base64').length === 32, 'must be 32 bytes in base64');

const EnvSchema = z
  .object({
    SIMULATOR_DATABASE_URL: z.url(),
    SIMULATOR_PARTICIPANT_KEY: key32,
    SIMULATOR_WEBHOOK_SECRET: key32,
    SIMULATOR_WEBHOOK_URL: z.url(),
    SIMULATOR_FAULTS: z.string().optional(),
    // Fixes the faults drawn, to repeat a run; random by default.
    SIMULATOR_SEED: z.coerce.number().int().optional(),
    PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
    HOST: z.string().default('127.0.0.1'),
  })
  // One secret per purpose: a leaked one never opens the other door.
  .refine((env) => env.SIMULATOR_PARTICIPANT_KEY !== env.SIMULATOR_WEBHOOK_SECRET, {
    message: 'SIMULATOR_PARTICIPANT_KEY and SIMULATOR_WEBHOOK_SECRET must differ',
  });

export interface SimulatorConfig {
  databaseUrl: string;
  participantKey: string;
  webhook: { url: string; secret: Buffer };
  faults: FaultProfile;
  seed: number;
  port: number;
  host: string;
}

/** Reads and checks the environment once at start: a bad value stops it. */
export function loadConfig(env: NodeJS.ProcessEnv): SimulatorConfig {
  const data = EnvSchema.parse(env);
  return {
    databaseUrl: data.SIMULATOR_DATABASE_URL,
    participantKey: data.SIMULATOR_PARTICIPANT_KEY,
    webhook: {
      url: data.SIMULATOR_WEBHOOK_URL,
      secret: Buffer.from(data.SIMULATOR_WEBHOOK_SECRET, 'base64'),
    },
    faults: parseFaultProfile(data.SIMULATOR_FAULTS),
    seed: data.SIMULATOR_SEED ?? Math.floor(Math.random() * 2 ** 31),
    port: data.PORT,
    host: data.HOST,
  };
}
