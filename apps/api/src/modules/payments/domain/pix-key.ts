import { Cpf } from '../../../shared/domain/cpf.ts';
import { PixKeyNotFound } from './errors.ts';

export type PixKeyType = 'CPF' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface PixKeyState {
  id: string;
  accountId: string;
  type: PixKeyType;
  /** Normalized value; personal sensitive data, encrypted when stored. */
  value: string;
  masked: string;
  createdAt: Date;
}

// The Bacen's random key (EVP) is a UUID; v4 is the one with no time or
// counter in it, so nothing about the key can be guessed.
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function randomValueOf(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return UUID_V4.test(value) ? value : null;
}

/** Only the ends show: enough for the customer to recognize the key. */
function maskRandom(value: string): string {
  return `${value.slice(0, 4)}****-****-****-****-********${value.slice(-4)}`;
}

/**
 * A public identifier that receives Pix for an account (domain-model.md 3.4).
 * Each customer has the holder's CPF, created at registration, so "a CPF key
 * is the holder's CPF" holds by construction; and, since v1.1.0, one random
 * key, the one shared in a QR Code so the CPF never is (PIX-12).
 */
export class PixKey {
  readonly #state: PixKeyState;

  private constructor(state: PixKeyState) {
    this.#state = state;
  }

  static forHolderCpf(input: { id: string; accountId: string; cpf: Cpf; now: Date }): PixKey {
    return new PixKey({
      id: input.id,
      accountId: input.accountId,
      type: 'CPF',
      value: input.cpf.digits,
      masked: input.cpf.masked,
      createdAt: input.now,
    });
  }

  /** The value comes from a source of random UUIDs; anything else is a wiring bug. */
  static random(input: { id: string; accountId: string; value: string; now: Date }): PixKey {
    const value = randomValueOf(input.value);
    if (value === null) throw new Error('Random Pix key must be a UUID v4');
    return new PixKey({
      id: input.id,
      accountId: input.accountId,
      type: 'RANDOM',
      value,
      masked: maskRandom(value),
      createdAt: input.now,
    });
  }

  get state(): Readonly<PixKeyState> {
    return { ...this.#state };
  }
}

// The DICT's limits: an e-mail of at most 77 characters, a Brazilian phone
// with its area code in the E.164 format.
const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;
const MAX_EMAIL_LENGTH = 77;
const PHONE = /^\+55[1-9][0-9][0-9]{8,9}$/;
const PHONE_PUNCTUATION = /[\s().-]/g;

function emailValueOf(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  return value.length <= MAX_EMAIL_LENGTH && EMAIL.test(value) ? value : null;
}

/** Typed with or without +55 and the usual punctuation. */
function phoneValueOf(raw: string): string | null {
  const digits = raw.trim().replace(PHONE_PUNCTUATION, '');
  const value = digits.startsWith('+') ? digits : `+55${digits}`;
  return PHONE.test(value) ? value : null;
}

function cpfValueOf(raw: string): string | null {
  try {
    return Cpf.parse(raw).digits;
  } catch {
    // Cpf.parse throws only InvalidCpf.
    return null;
  }
}

/**
 * The normalized value to look a key up by, here or in the DICT. A value that
 * no key can have (an invalid CPF, a malformed e-mail) is simply not found.
 */
export function pixKeyValue(type: PixKeyType, raw: string): string {
  const value = {
    CPF: cpfValueOf,
    EMAIL: emailValueOf,
    PHONE: phoneValueOf,
    RANDOM: randomValueOf,
  }[type](raw);
  if (value === null) throw new PixKeyNotFound();
  return value;
}

/** next bank registers only the holder's CPF and the random key: the rest are elsewhere. */
export function isRegisteredHere(type: PixKeyType): boolean {
  return type === 'CPF' || type === 'RANDOM';
}

/** A normalized key as the payer sees it: enough to recognize, never all of it. */
export function maskedKeyValue(type: PixKeyType, value: string): string {
  switch (type) {
    case 'CPF':
      return Cpf.parse(value).masked;
    case 'EMAIL': {
      // Two letters of the name, or one when it is that short.
      const at = value.indexOf('@');
      return `${value.slice(0, at > 2 ? 2 : 1)}***${value.slice(at)}`;
    }
    case 'PHONE':
      return `${value.slice(0, 5)}${'*'.repeat(value.length - 9)}${value.slice(-4)}`;
    case 'RANDOM':
      return maskRandom(value);
  }
}
