import 'package:next_bank/core/session/session_tokens.dart';
import 'package:nextbank_api/nextbank_api.dart';

/// The single translation from the contract's tokens to the app's session,
/// used by registration, login and refresh alike.
SessionTokens sessionTokensFrom(AuthTokens tokens) => SessionTokens(
  accessToken: tokens.accessToken,
  accessTokenExpiresAt: tokens.accessTokenExpiresAt,
  refreshToken: tokens.refreshToken,
);
