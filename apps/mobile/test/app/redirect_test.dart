import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/session/session_end_reason.dart';

import '../support/fake_token_store.dart';

// Navigation rules (domain-model.md, section 10): the session decides where
// the app can be; an ended session goes back to login from any screen; a
// signed-in account without its PIN always resumes at the PIN creation.
void main() {
  const loading = AsyncLoading<Session>();
  final failed = AsyncError<Session>(StateError('keystore'), StackTrace.empty);
  const signedOut = AsyncData<Session>(SignedOut());
  const revoked = AsyncData<Session>(SignedOut(SessionEndReason.revoked));
  final signedIn = AsyncData<Session>(SignedIn(tokens));

  const noProfile = AsyncData<Profile?>(null);
  const profileLoading = AsyncLoading<Profile?>();
  final profileFailed = AsyncError<Profile?>(
    StateError('offline'),
    StackTrace.empty,
  );
  const withPin = AsyncData<Profile?>(Profile(name: 'Ana', hasPin: true));
  const withoutPin = AsyncData<Profile?>(Profile(name: 'Ana', hasPin: false));

  for (final (name, session, profile, location, expected) in [
    // Session not known yet.
    ('restoring', loading, noProfile, AppRoutes.home, AppRoutes.splash),
    ('restoring, on splash', loading, noProfile, AppRoutes.splash, null),
    (
      'restoring, on register',
      loading,
      noProfile,
      AppRoutes.register,
      AppRoutes.splash,
    ),
    ('storage failed', failed, noProfile, AppRoutes.login, AppRoutes.splash),
    // Signed out.
    (
      'signed out, on home',
      signedOut,
      noProfile,
      AppRoutes.home,
      AppRoutes.login,
    ),
    (
      'signed out, on splash',
      signedOut,
      noProfile,
      AppRoutes.splash,
      AppRoutes.login,
    ),
    ('signed out, on login', signedOut, noProfile, AppRoutes.login, null),
    ('signed out, on register', signedOut, noProfile, AppRoutes.register, null),
    (
      'signed out, on create-pin',
      signedOut,
      noProfile,
      AppRoutes.createPin,
      AppRoutes.login,
    ),
    ('revoked, on home', revoked, noProfile, AppRoutes.home, AppRoutes.login),
    // Signed in, profile not known yet: splash says it is opening, or retries.
    (
      'profile loading, on login',
      signedIn,
      profileLoading,
      AppRoutes.login,
      AppRoutes.splash,
    ),
    (
      'profile loading, on register',
      signedIn,
      profileLoading,
      AppRoutes.register,
      AppRoutes.splash,
    ),
    (
      'profile loading, on splash',
      signedIn,
      profileLoading,
      AppRoutes.splash,
      null,
    ),
    (
      'profile failed, on home',
      signedIn,
      profileFailed,
      AppRoutes.home,
      AppRoutes.splash,
    ),
    // Signed in without the PIN: always back to the PIN creation.
    (
      'no PIN, on splash',
      signedIn,
      withoutPin,
      AppRoutes.splash,
      AppRoutes.createPin,
    ),
    (
      'no PIN, on login',
      signedIn,
      withoutPin,
      AppRoutes.login,
      AppRoutes.createPin,
    ),
    (
      'no PIN, on register',
      signedIn,
      withoutPin,
      AppRoutes.register,
      AppRoutes.createPin,
    ),
    (
      'no PIN, on home',
      signedIn,
      withoutPin,
      AppRoutes.home,
      AppRoutes.createPin,
    ),
    ('no PIN, on create-pin', signedIn, withoutPin, AppRoutes.createPin, null),
    // Signed in with the PIN: entry screens lead to the home.
    (
      'with PIN, on splash',
      signedIn,
      withPin,
      AppRoutes.splash,
      AppRoutes.home,
    ),
    ('with PIN, on login', signedIn, withPin, AppRoutes.login, AppRoutes.home),
    (
      'with PIN, on register',
      signedIn,
      withPin,
      AppRoutes.register,
      AppRoutes.home,
    ),
    (
      'with PIN, on create-pin',
      signedIn,
      withPin,
      AppRoutes.createPin,
      AppRoutes.home,
    ),
    ('with PIN, on home', signedIn, withPin, AppRoutes.home, null),
  ]) {
    test('$name → ${expected ?? 'stays'}', () {
      expect(redirectFor(session, profile, location, locked: false), expected);
    });
  }

  // The Unlock screen (F-16, PIX-06): a locked app asks for the PIN before
  // anything a signed-in customer can do.
  group('locked', () {
    for (final (name, session, profile, location, expected) in [
      (
        'with PIN, on splash',
        signedIn,
        withPin,
        AppRoutes.splash,
        AppRoutes.unlock,
      ),
      (
        'with PIN, on home',
        signedIn,
        withPin,
        AppRoutes.home,
        AppRoutes.unlock,
      ),
      ('with PIN, on unlock', signedIn, withPin, AppRoutes.unlock, null),
      // No PIN to unlock with: the PIN creation comes first.
      (
        'no PIN, on unlock',
        signedIn,
        withoutPin,
        AppRoutes.unlock,
        AppRoutes.createPin,
      ),
      (
        'signed out, on unlock',
        signedOut,
        noProfile,
        AppRoutes.unlock,
        AppRoutes.login,
      ),
      (
        'profile loading, on unlock',
        signedIn,
        profileLoading,
        AppRoutes.unlock,
        AppRoutes.splash,
      ),
    ]) {
      test('$name → ${expected ?? 'stays'}', () {
        expect(redirectFor(session, profile, location, locked: true), expected);
      });
    }

    test('unlocked, on unlock → home', () {
      expect(
        redirectFor(signedIn, withPin, AppRoutes.unlock, locked: false),
        AppRoutes.home,
      );
    });
  });
}
