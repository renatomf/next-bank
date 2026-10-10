import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/nav_shell.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/create_pin/create_pin_screen.dart';
import 'package:next_bank/features/auth/presentation/login/login_screen.dart';
import 'package:next_bank/features/auth/presentation/register/register_screen.dart';
import 'package:next_bank/features/auth/presentation/sign_out/sign_out_button.dart';
import 'package:next_bank/features/auth/presentation/splash/splash_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/processing/processing_screen.dart';
import 'package:next_bank/features/pix/presentation/receipt/receipt_screen.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/features/profile/presentation/profile_screen.dart';
import 'package:next_bank/features/security/presentation/change_password/change_password_screen.dart';
import 'package:next_bank/features/security/presentation/change_pin/change_pin_screen.dart';
import 'package:next_bank/features/security/presentation/sessions/security_screen.dart';
import 'package:next_bank/features/statement/presentation/detail/statement_detail_screen.dart';
import 'package:next_bank/features/statement/presentation/list/statement_screen.dart';
import 'package:next_bank/features/unlock/presentation/unlock_screen.dart';

/// The app's navigation. It lives outside the features because it is the
/// one place that knows all of them: here the home gets the auth feature's
/// sign-out button without the two features importing each other.
final Provider<GoRouter> routerProvider = Provider((ref) {
  // The router asks for its redirect again whenever the session, the profile
  // or the lock changes.
  final session = ValueNotifier<AsyncValue<Session>>(ref.read(sessionProvider));
  final profile = ValueNotifier<AsyncValue<Profile?>>(
    ref.read(profileProvider),
  );
  final locked = ValueNotifier<bool>(ref.read(appLockProvider));
  ref
    ..listen(sessionProvider, (_, next) => session.value = next)
    ..listen(profileProvider, (_, next) => profile.value = next)
    ..listen(appLockProvider, (_, next) => locked.value = next)
    ..onDispose(session.dispose)
    ..onDispose(profile.dispose)
    ..onDispose(locked.dispose);

  final router = GoRouter(
    initialLocation: AppRoutes.splash,
    refreshListenable: Listenable.merge([session, profile, locked]),
    redirect: (_, state) => redirectFor(
      session.value,
      profile.value,
      state.matchedLocation,
      locked: locked.value,
    ),
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
        path: AppRoutes.unlock,
        builder: (_, _) => const UnlockScreen(actions: [SignOutButton()]),
      ),
      // The five areas of the app share the floating bar (week 7 plan, D7);
      // every flow (Pix, details, changes) opens over it, without the bar.
      ShellRoute(
        builder: (context, state, child) =>
            NavShell(location: state.matchedLocation, child: child),
        routes: [
          GoRoute(
            path: AppRoutes.home,
            builder: (context, _) => HomeScreen(
              onPix: () => context.push(AppRoutes.pix),
              onStatement: () => context.go(AppRoutes.statement),
              onMovement: (id) => context.push(AppRoutes.statementItem(id)),
            ),
          ),
          GoRoute(
            path: AppRoutes.statement,
            builder: (context, _) => StatementScreen(
              onItem: (id) => context.push(AppRoutes.statementItem(id)),
            ),
          ),
          GoRoute(
            path: AppRoutes.security,
            builder: (context, _) => SecurityScreen(
              onChangePin: () => context.push(AppRoutes.changePin),
              onChangePassword: () => context.push(AppRoutes.changePassword),
            ),
          ),
          GoRoute(
            path: AppRoutes.profile,
            builder: (context, _) => ProfileScreen(
              onSecurity: () => context.go(AppRoutes.security),
              // T3-1: signing out lives on the Profile.
              signOut: const SignOutButton(),
            ),
          ),
        ],
      ),
      // Opened over the Home, and the review over the Pix, so back returns
      // to them; once authorized, the Pix replaces the stack, so back never
      // returns to the PIN (domain-model.md 10).
      GoRoute(
        path: AppRoutes.pix,
        builder: (context, _) => SendPixScreen(
          onBack: () => _back(context),
          onReview: (id) => context.push(AppRoutes.pixReview(id)),
        ),
      ),
      GoRoute(
        path: AppRoutes.pixReview(':transferId'),
        builder: (context, state) => ReviewPixScreen(
          transferId: _transferIdOf(state),
          onBack: () => _back(context),
          onHome: () => context.go(AppRoutes.home),
          onFinished: (transfer) => context.go(
            transfer.status == PixStatus.completed
                ? AppRoutes.pixReceipt(transfer.id)
                : AppRoutes.pixProcessing(transfer.id),
          ),
        ),
      ),
      GoRoute(
        path: AppRoutes.pixProcessing(':transferId'),
        builder: (context, state) {
          final transferId = _transferIdOf(state);
          return ProcessingScreen(
            transferId: transferId,
            onHome: () => context.go(AppRoutes.home),
            onReceipt: () => context.go(AppRoutes.pixReceipt(transferId)),
          );
        },
      ),
      GoRoute(
        path: AppRoutes.pixReceipt(':transferId'),
        builder: (context, state) => ReceiptScreen(
          transferId: _transferIdOf(state),
          // Pushed from a statement detail, back returns to it (T4-3);
          // after a Pix just sent nothing is below, so it goes home.
          onClose: () => _back(context),
          onHome: () => context.go(AppRoutes.home),
        ),
      ),
      // The detail opens over the statement or the Home, the receipt over it.
      GoRoute(
        path: AppRoutes.statementItem(':itemId'),
        builder: (context, state) => StatementDetailScreen(
          itemId: state.pathParameters['itemId'] ?? '',
          onBack: () => _back(context),
          onReceipt: (transferId) =>
              context.push(AppRoutes.pixReceipt(transferId)),
        ),
      ),
      // The changes open over Security, so back and done return to it.
      GoRoute(
        path: AppRoutes.changePin,
        builder: (context, _) => ChangePinScreen(
          onBack: () => _back(context),
          onDone: () => _back(context),
        ),
      ),
      GoRoute(
        path: AppRoutes.changePassword,
        builder: (context, _) => ChangePasswordScreen(
          onBack: () => _back(context),
          onDone: () => _back(context),
        ),
      ),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

/// Back to the screen below, or to the Home when there is none.
void _back(BuildContext context) =>
    context.canPop() ? context.pop() : context.go(AppRoutes.home);

/// The Pix id in the path; the route never matches without it.
String _transferIdOf(GoRouterState state) =>
    state.pathParameters['transferId'] ?? '';
