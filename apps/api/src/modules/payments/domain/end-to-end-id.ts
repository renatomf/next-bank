// A fictitious ISPB: next bank is not a participant of the Bacen's Pix.
export const NEXT_BANK_ISPB = '00000000';
const RANDOM_PART = /^[A-Za-z0-9]{11}$/;

/**
 * The end-to-end id of a completed Pix, in the Bacen layout (week 5 plan, D10):
 * "E", the ISPB, the UTC minute of completion (yyyyMMddHHmm) and 11 random
 * letters or digits, which the caller draws so the domain stays deterministic.
 */
export function endToEndId(completedAt: Date, random: string): string {
  if (!RANDOM_PART.test(random)) {
    throw new Error('The random part of an end-to-end id is 11 letters or digits');
  }
  const minute = completedAt.toISOString().slice(0, 16).replace(/\D/g, '');
  return `E${NEXT_BANK_ISPB}${minute}${random}`;
}
