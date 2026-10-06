import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// The app's screens.
abstract final class AppRoutes {
  /// Shown while the session is restored from the device.
  static const String splash = '/splash';

  /// Entry point without a session.
  static const String login = '/login';

  /// Home of a signed-in user.
  static const String home = '/home';
}

/// Where the app must be for the current [session], or null to stay at
/// [location] (domain-model.md, section 10). An ended session goes back to
/// login from any screen.
String? redirectFor(AsyncValue<Session> session, String location) {
  final target = switch (session) {
    AsyncData(value: SignedIn()) =>
      location == AppRoutes.splash || location == AppRoutes.login
          ? AppRoutes.home
          : location,
    AsyncData(value: SignedOut()) => AppRoutes.login,
    // Still restoring, or the device storage failed: splash shows which.
    _ => AppRoutes.splash,
  };
  return target == location ? null : target;
}
