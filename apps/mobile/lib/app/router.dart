import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/create_pin_screen.dart';
import 'package:next_bank/features/auth/presentation/login_screen.dart';
import 'package:next_bank/features/auth/presentation/register_screen.dart';
import 'package:next_bank/features/auth/presentation/sign_out_button.dart';
import 'package:next_bank/features/auth/presentation/splash_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

/// The app's navigation. It lives outside the features because it is the
/// one place that knows all of them: here the home gets the auth feature's
/// sign-out button without the two features importing each other.
final Provider<GoRouter> routerProvider = Provider((ref) {
  // The router asks for its redirect again whenever the session or the
  // profile changes.
  final session = ValueNotifier<AsyncValue<Session>>(ref.read(sessionProvider));
  final profile = ValueNotifier<AsyncValue<Profile?>>(
    ref.read(profileProvider),
  );
  ref
    ..listen(sessionProvider, (_, next) => session.value = next)
    ..listen(profileProvider, (_, next) => profile.value = next)
    ..onDispose(session.dispose)
    ..onDispose(profile.dispose);

  final router = GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: Listenable.merge([session, profile]),
    redirect: (_, state) =>
        redirectFor(session.value, profile.value, state.matchedLocation),
    routes: [
      GoRoute(path: AppRoutes.splash, builder: (_, _) => const SplashScreen()),
      GoRoute(
        path: AppRoutes.login,
        builder: (context, _) =>
            LoginScreen(onRegister: () => context.go(AppRoutes.register)),
      ),
      GoRoute(
        path: AppRoutes.register,
        builder: (context, _) =>
            RegisterScreen(onLogin: () => context.go(AppRoutes.login)),
      ),
      GoRoute(
        path: AppRoutes.createPin,
        builder: (context, _) =>
            CreatePinScreen(onCreated: () => context.go(AppRoutes.home)),
      ),
      GoRoute(
        path: AppRoutes.home,
        builder: (_, _) => const HomeScreen(actions: [SignOutButton()]),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});
