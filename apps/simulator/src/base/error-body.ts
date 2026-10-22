import { z } from 'zod';

/** Every refusal of the simulator: just a code, never an internal detail. */
export const ErrorBodySchema = z.strictObject({ code: z.string() });
