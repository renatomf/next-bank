import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/nav_shell.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/areas/presentation/area_placeholder_screen.dart';
import 'package:next_bank/features/assistant/presentation/assistant_screen.dart';
import 'package:next_bank/features/auth/presentation/create_pin/create_pin_screen.dart';
import 'package:next_bank/features/auth/presentation/login/login_screen.dart';
import 'package:next_bank/features/auth/presentation/register/register_screen.dart';
import 'package:next_bank/features/auth/presentation/sign_out/sign_out_button.dart';
import 'package:next_bank/features/auth/presentation/sign_out/switch_account_button.dart';
import 'package:next_bank/features/auth/presentation/splash/splash_screen.dart';
import 'package:next_bank/features/help/presentation/help_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/menu/presentation/menu_screen.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notifications_screen.dart';
import 'package:next_bank/features/notifications/presentation/settings/notification_settings_screen.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/automatic/pix_automatic_screen.dart';
import 'package:next_bank/features/pix/presentation/keys/pix_keys_screen.dart';
import 'package:next_bank/features/pix/presentation/processing/processing_screen.dart';
import 'package:next_bank/features/pix/presentation/receipt/receipt_screen.dart';
import 'package:next_bank/features/pix/presentation/receive/receive_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/scan/scan_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/transfer/transfer_pix_screen.dart';
import 'package:next_bank/features/profile/presentation/blank/profile_blank_screen.dart';
import 'package:next_bank/features/profile/presentation/profile_screen.dart';
import 'package:next_bank/features/profile/presentation/theme/theme_screen.dart';
import 'package:next_bank/features/recharge/domain/carrier.dart';
import 'package:next_bank/features/recharge/presentation/amount/recharge_amount_screen.dart';
import 'package:next_bank/features/recharge/presentation/recharge_screen.dart';
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
        builder: (_, _) =>
            const UnlockScreen(otherAccount: SwitchAccountButton()),
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
              // The code read fills the Pix screen, so it goes beneath the
              // reading: back from either lands where it should.
              onPay: () {
                unawaited(context.push(AppRoutes.pix));
                unawaited(context.push(AppRoutes.pixScan));
              },
              onReceive: () => context.push(AppRoutes.pixReceive),
              onPixWithKey: (cpf) => context.push(AppRoutes.pix, extra: cpf),
              onTransfer: () => context.push(AppRoutes.pixTransfer),
              onAutomatic: () => context.push(AppRoutes.pixAutomatic),
              onKeys: () => context.push(AppRoutes.pixKeys),
              onStatement: () => context.go(AppRoutes.statement),
              onProfile: () => context.go(AppRoutes.profile),
              onHelp: () => context.push(AppRoutes.help),
              onAssistant: () => context.push(AppRoutes.assistant),
              onRecharge: () => context.push(AppRoutes.recharge),
              onNotifications: () => context.push(AppRoutes.notifications),
            ),
          ),
          GoRoute(
            path: AppRoutes.statement,
            builder: (context, _) => StatementScreen(
              onBack: () => context.go(AppRoutes.home),
              onItem: (id) => context.push(AppRoutes.statementItem(id)),
              onPay: () {
                unawaited(context.push(AppRoutes.pix));
                unawaited(context.push(AppRoutes.pixScan));
              },
              onPix: () => context.push(AppRoutes.pix),
            ),
          ),
          // v1.1.0 plan, task 4.11: title only, until their layouts.
          for (final (path, title) in [
            (AppRoutes.cards, 'Cartões'),
            (AppRoutes.investments, 'Investimentos'),
          ])
            GoRoute(
              path: path,
              builder: (_, _) => AreaPlaceholderScreen(title: title),
            ),
          GoRoute(path: AppRoutes.menu, builder: (_, _) => const MenuScreen()),
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
              onClose: () => context.go(AppRoutes.home),
              onPersonalData: () => context.push(AppRoutes.personalData),
              onSharedAccount: () => context.push(AppRoutes.sharedAccount),
              onInviteFriends: () => context.push(AppRoutes.inviteFriends),
              onTheme: () => context.push(AppRoutes.profileTheme),
              onChangePin: () => context.push(AppRoutes.changePin),
              onChangePassword: () => context.push(AppRoutes.changePassword),
              onSecurity: () => context.push(AppRoutes.profileSecurity),
              onManageAccounts: () => context.push(AppRoutes.manageAccounts),
              // T3-1: signing out lives on the Profile.
              signOut: const SignOutButton(),
              switchAccount: const SwitchAccountButton(
                label: 'Trocar conta',
                askFirst: true,
              ),
            ),
          ),
        ],
      ),
      // Opened over the Home, and the review over the Pix, so back returns
      // to them; once authorized, the Pix replaces the stack, so back never
      // returns to the PIN (domain-model.md 10).
      GoRoute(
        path: AppRoutes.pix,
        builder: (context, state) => SendPixScreen(
          // The CPF from the Home's Pix box rides as extra, never in the URL.
          initialCpf: state.extra is String ? state.extra! as String : null,
          onBack: () => _back(context),
          onReceive: () => context.push(AppRoutes.pixReceive),
          onReview: (id) => context.push(AppRoutes.pixReview(id)),
        ),
      ),
      GoRoute(
        path: AppRoutes.pixScan,
        builder: (context, _) => ScanPixScreen(
          // Opened from the Home's "Pagar": without a code, back is the
          // Home; a code read goes to the Pix beneath, filled.
          onBack: () => context.go(AppRoutes.home),
          onRead: () => _back(context),
        ),
      ),
      GoRoute(
        path: AppRoutes.pixTransfer,
        builder: (context, _) => TransferPixScreen(
          onBack: () => _back(context),
          // As the Home's "Pagar": a code read fills the Pix beneath.
          onScan: () {
            unawaited(context.push(AppRoutes.pix));
            unawaited(context.push(AppRoutes.pixScan));
          },
        ),
      ),
      GoRoute(
        path: AppRoutes.pixAutomatic,
        builder: (context, _) =>
            PixAutomaticScreen(onBack: () => _back(context)),
      ),
      GoRoute(
        path: AppRoutes.pixKeys,
        builder: (context, _) => PixKeysScreen(onBack: () => _back(context)),
      ),
      GoRoute(
        path: AppRoutes.pixReceive,
        builder: (context, _) => ReceivePixScreen(onBack: () => _back(context)),
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
        path: AppRoutes.assistant,
        builder: (context, _) => AssistantScreen(onClose: () => _back(context)),
      ),
      GoRoute(
        path: AppRoutes.recharge,
        builder: (context, _) => RechargeScreen(
          onBack: () => _back(context),
          onCarrier: (carrier, phone) => context.push(
            AppRoutes.rechargeAmount,
            extra: (carrier: carrier, phone: phone),
          ),
        ),
      ),
      GoRoute(
        path: AppRoutes.rechargeAmount,
        builder: (context, state) {
          // Opened only from the carriers, which always send both; deep
          // links are off (MOB-06).
          final (:carrier, :phone) =
              state.extra! as ({Carrier carrier, String phone});
          return RechargeAmountScreen(
            carrier: carrier,
            phone: phone,
            onBack: () => _back(context),
          );
        },
      ),
      GoRoute(
        path: AppRoutes.help,
        builder: (context, _) => HelpScreen(onBack: () => _back(context)),
      ),
      GoRoute(
        path: AppRoutes.notifications,
        builder: (context, _) => NotificationsScreen(
          onBack: () => _back(context),
          onSettings: () => context.push(AppRoutes.notificationSettings),
        ),
      ),
      GoRoute(
        path: AppRoutes.notificationSettings,
        builder: (context, _) =>
            NotificationSettingsScreen(onBack: () => _back(context)),
      ),
      // Opened over the Profile, so back returns to it (v1.1.0 plan, 4.4).
      GoRoute(
        path: AppRoutes.profileTheme,
        builder: (context, _) => ThemeScreen(onBack: () => _back(context)),
      ),
      GoRoute(
        path: AppRoutes.profileSecurity,
        builder: (context, _) => SecurityScreen(
          onBack: () => _back(context),
          onChangePin: () => context.push(AppRoutes.changePin),
          onChangePassword: () => context.push(AppRoutes.changePassword),
        ),
      ),
      for (final (path, title) in [
        (AppRoutes.personalData, 'Meus dados cadastrais'),
        (AppRoutes.sharedAccount, 'Conta compartilhada'),
        (AppRoutes.inviteFriends, 'Convidar amigos'),
        (AppRoutes.manageAccounts, 'Gerenciar contas'),
      ])
        GoRoute(
          path: path,
          builder: (context, _) =>
              ProfileBlankScreen(title: title, onBack: () => _back(context)),
        ),
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
