import 'package:next_bank/core/session/session_tokens.dart';
import 'package:next_bank/core/session/token_store.dart';

/// In-memory [TokenStore] that records how often it was cleared.
class FakeTokenStore implements TokenStore {
  new([this.stored]);

  SessionTokens? stored;
  int clears = 0;

  @override
  Future<SessionTokens?> read() async => stored;

  @override
  Future<void> write(SessionTokens tokens) async => stored = tokens;

  @override
  Future<void> clear() async {
    clears++;
    stored = null;
  }
}

/// A session as the device would hold it.
final SessionTokens tokens = SessionTokens(
  accessToken: 'access-token-value',
  accessTokenExpiresAt: DateTime.utc(2026, 10, 6, 12, 15),
  refreshToken: 'refresh-token-value',
);
