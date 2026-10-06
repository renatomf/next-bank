import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// The app's screens.
abstract final class AppRoutes {
  /// Shown while the session is restored from the device.
  static const String splash = '/splash';

  /// Entry point without a session.
  static const String login = '/login';

  /// Registration with a fictitious CPF.
  static const String register = '/register';

  /// Transaction PIN creation, right after the registration.
  static const String createPin = '/create-pin';

  /// Home of a signed-in user.
  static const String home = '/home';
}

/// Where the app must be for the current [session], or null to stay at
/// [location] (domain-model.md, section 10). An ended session goes back to
/// login from any screen.
String? redirectFor(AsyncValue<Session> session, String location) {
  final target = switch (session) {
    AsyncData(value: SignedIn()) => switch (location) {
      AppRoutes.splash || AppRoutes.login => AppRoutes.home,
      // A finished registration always continues to the PIN.
      AppRoutes.register => AppRoutes.createPin,
      _ => location,
    },
    AsyncData(value: SignedOut()) =>
      location == AppRoutes.register ? location : AppRoutes.login,
    // Still restoring, or the device storage failed: splash shows which.
    _ => AppRoutes.splash,
  };
  return target == location ? null : target;
}
