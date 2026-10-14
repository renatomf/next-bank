import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';
import 'package:next_bank/core/session/session_end_reason.dart';
import 'package:next_bank/core/session/session_tokens.dart';
import 'package:next_bank/core/session/token_store.dart';

/// Where the session is kept. Bound to `SecureTokenStore` by the composition
/// root (`main.dart`); tests override it with a fake.
final Provider<TokenStore> tokenStoreProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// Whether someone is signed in on this device.
sealed class Session {
  const new();
}

/// A session with its tokens.
final class SignedIn extends Session {
  /// Creates a signed-in session.
  const new(this.tokens);

  /// Tokens of the session.
  final SessionTokens tokens;
}

/// No session: the app asks for login.
final class SignedOut extends Session {
  /// Creates the signed-out state.
  const new([this.reason]);

  /// Why the server ended the session; null after a logout or when there
  /// was no session.
  final SessionEndReason? reason;
}

/// The current session. While it is loading, the app is restoring it from the
/// device on start.
final AsyncNotifierProvider<SessionController, Session> sessionProvider =
    AsyncNotifierProvider(SessionController.new);

/// Restores, starts and ends the session, keeping the device in step.
class SessionController extends AsyncNotifier<Session> {
  @override
  Future<Session> build() async {
    final tokens = await ref.read(tokenStoreProvider).read();
    return tokens == null ? const SignedOut() : SignedIn(tokens);
  }

  /// Keeps the tokens on the device before reporting the session as started.
  Future<void> signIn(SessionTokens tokens) async {
    await ref.read(tokenStoreProvider).write(tokens);
    state = AsyncData(SignedIn(tokens));
  }

  /// Removes the tokens from the device (AUTH-06, app side), keeping the
  /// [reason] when the server ended the session.
  Future<void> signOut([SessionEndReason? reason]) async {
    await ref.read(tokenStoreProvider).clear();
    // Nothing of the account stays for whoever signs in next on this phone
    // (v1.1.0 plan, task 2; MOB-11, MOB-12).
    await ref.read(biometricPinStoreProvider).clear();
    await ref.read(greetingNameStoreProvider).clear();
    state = AsyncData(SignedOut(reason));
  }
}
