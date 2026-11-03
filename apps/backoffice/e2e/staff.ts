import { Secret, TOTP } from 'otpauth';

/**
 * The demo staff the seed creates (apps/api/scripts/create-staff.ts), with
 * the credentials the README publishes: an operator and an analyst who see
 * only the demo customers (B5, STF-11). Fictitious, and public on purpose.
 */
export const STAFF = {
  olivia: {
    email: 'olivia.demo@example.com',
    password: 'demo-olivia-next-bank',
    totp: new TOTP({ secret: Secret.fromLatin1('olivia demo next bank') }),
  },
  diogo: {
    email: 'diogo.demo@example.com',
    password: 'demo-diogo-next-bank',
    totp: new TOTP({ secret: Secret.fromLatin1('diogo demo next bank') }),
  },
} as const;

export type StaffName = keyof typeof STAFF;

/** Where the setup keeps each member's session; ignored by git (a cookie is a secret). */
export const sessionOf = (name: StaffName) => `e2e/.auth/${name}.json`;
