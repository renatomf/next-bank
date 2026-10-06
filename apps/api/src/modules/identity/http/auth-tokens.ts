import { z } from 'zod';

/** What the app receives when a session starts, by registration or login (READ-02). */
export const AuthTokensSchema = z
  .object({
    tokenType: z.literal('Bearer'),
    accessToken: z.string(),
    accessTokenExpiresAt: z.iso.datetime(),
    refreshToken: z.string(),
  })
  .meta({ id: 'AuthTokens' });

/** Only what the app needs to use the session: no ids or personal data. */
export function authTokensBody(tokens: {
  accessToken: string;
  accessTokenExpiresAt: Date;
  refreshToken: string;
}): z.infer<typeof AuthTokensSchema> {
  return {
    tokenType: 'Bearer',
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessTokenExpiresAt.toISOString(),
    refreshToken: tokens.refreshToken,
  };
}
