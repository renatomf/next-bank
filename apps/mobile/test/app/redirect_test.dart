import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/session/session_end_reason.dart';

import '../support/fake_token_store.dart';

// Navigation rules (domain-model.md, section 10): the session decides where
// the app can be; an ended session goes back to login from any screen.
void main() {
  const loading = AsyncLoading<Session>();
  final failed = AsyncError<Session>(StateError('keystore'), StackTrace.empty);
  const signedOut = AsyncData<Session>(SignedOut());
  const revoked = AsyncData<Session>(SignedOut(SessionEndReason.revoked));
  final signedIn = AsyncData<Session>(SignedIn(tokens));

  for (final (name, session, location, expected) in [
    ('restoring the session', loading, AppRoutes.home, AppRoutes.splash),
    ('restoring, already on splash', loading, AppRoutes.splash, null),
    ('the device storage failed', failed, AppRoutes.login, AppRoutes.splash),
    ('signed out, on home', signedOut, AppRoutes.home, AppRoutes.login),
    ('signed out, on splash', signedOut, AppRoutes.splash, AppRoutes.login),
    ('signed out, on login', signedOut, AppRoutes.login, null),
    ('session revoked, on home', revoked, AppRoutes.home, AppRoutes.login),
    ('signed in, on splash', signedIn, AppRoutes.splash, AppRoutes.home),
    ('signed in, on login', signedIn, AppRoutes.login, AppRoutes.home),
    ('signed in, on home', signedIn, AppRoutes.home, null),
  ]) {
    test('$name → ${expected ?? 'stays'}', () {
      expect(redirectFor(session, location), expected);
    });
  }
}
