import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// The app's screens.
abstract final class AppRoutes {
  /// Shown while the session is restored from the device.
  static const String splash = '/splash';

  /// Entry point without a session.
  static const String login = '/login';

  /// Registration with a fictitious CPF.
  static const String register = '/register';

  /// Transaction PIN creation, whenever the account has no PIN yet.
  static const String createPin = '/create-pin';

  /// Home of a signed-in user.
  static const String home = '/home';
}

/// Where the app must be for the current [session] and its [profile], or
/// null to stay at [location] (domain-model.md, section 10). An ended
/// session goes back to login from any screen; an account without its PIN
/// always resumes at the PIN creation.
String? redirectFor(
  AsyncValue<Session> session,
  AsyncValue<Profile?> profile,
  String location,
) {
  final target = switch (session) {
    AsyncData(value: SignedIn()) => _signedInTarget(profile, location),
    AsyncData(value: SignedOut()) =>
      location == AppRoutes.register ? location : AppRoutes.login,
    // Still restoring, or the device storage failed: splash shows which.
    _ => AppRoutes.splash,
  };
  return target == location ? null : target;
}

String _signedInTarget(AsyncValue<Profile?> profile, String location) =>
    switch (profile) {
      AsyncData(value: Profile(hasPin: false)) => AppRoutes.createPin,
      AsyncData(value: Profile(hasPin: true)) => switch (location) {
        AppRoutes.splash ||
        AppRoutes.login ||
        AppRoutes.register ||
        AppRoutes.createPin => AppRoutes.home,
        _ => location,
      },
      // Not known yet, or it could not be loaded: splash shows which.
      _ => AppRoutes.splash,
    };
