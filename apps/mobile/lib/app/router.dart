import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/nav_shell.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/cards/example_cards.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/assistant/presentation/assistant_screen.dart';
import 'package:next_bank/features/auth/presentation/create_pin/create_pin_screen.dart';
import 'package:next_bank/features/auth/presentation/login/login_screen.dart';
import 'package:next_bank/features/auth/presentation/register/register_screen.dart';
import 'package:next_bank/features/auth/presentation/sign_out/sign_out_button.dart';
import 'package:next_bank/features/auth/presentation/sign_out/switch_account_button.dart';
import 'package:next_bank/features/auth/presentation/splash/splash_screen.dart';
import 'package:next_bank/features/cards/presentation/cards_screen.dart';
import 'package:next_bank/features/help/presentation/help_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/investments/presentation/investments_screen.dart';
import 'package:next_bank/features/menu/presentation/menu_screen.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notifications_screen.dart';
import 'package:next_bank/features/notifications/presentation/settings/notification_settings_screen.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/automatic/pix_automatic_screen.dart';
import 'package:next_bank/features/pix/presentation/keys/pix_keys_screen.dart';
import 'package:next_bank/features/pix/presentation/new_schedule/new_schedule_controller.dart';
import 'package:next_bank/features/pix/presentation/new_schedule/new_schedule_screen.dart';
import 'package:next_bank/features/pix/presentation/processing/processing_screen.dart';
import 'package:next_bank/features/pix/presentation/receipt/receipt_screen.dart';
import 'package:next_bank/features/pix/presentation/receive/receive_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/scan/scan_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/schedule_detail/schedule_detail_screen.dart';
import 'package:next_bank/features/pix/presentation/schedules/schedules_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/transfer/transfer_pix_screen.dart';
import 'package:next_bank/features/profile/presentation/blank/profile_blank_screen.dart';
import 'package:next_bank/features/profile/presentation/profile_screen.dart';
import 'package:next_bank/features/profile/presentation/theme/theme_screen.dart';
import 'package:next_bank/features/security/presentation/change_password/change_password_screen.dart';
import 'package:next_bank/features/security/presentation/change_pin/change_pin_screen.dart';
import 'package:next_bank/features/security/presentation/sessions/security_screen.dart';
import 'package:next_bank/features/statement/presentation/detail/statement_detail_screen.dart';
import 'package:next_bank/features/statement/presentation/list/statement_screen.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/presentation/amount/top_up_amount_screen.dart';
import 'package:next_bank/features/top_up/presentation/confirm/confirm_top_up_controller.dart';
import 'package:next_bank/features/top_up/presentation/confirm/confirm_top_up_screen.dart';
import 'package:next_bank/features/top_up/presentation/operators/top_up_operators_screen.dart';
import 'package:next_bank/features/top_up/presentation/receipt/top_up_receipt_screen.dart';
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
              onSchedules: () => context.push(AppRoutes.pixSchedules),
              onProfile: () => context.go(AppRoutes.profile),
              onHelp: () => context.push(AppRoutes.help),
              onAssistant: () => context.push(AppRoutes.assistant),
              onRecharge: () => context.push(AppRoutes.topUps),
              onCardDetails: (index) =>
                  context.go('${AppRoutes.cards}?card=$index'),
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
          GoRoute(
            path: AppRoutes.investments,
            builder: (context, _) =>
                InvestmentsScreen(onBack: () => _back(context)),
          ),
          GoRoute(
            path: AppRoutes.cards,
            builder: (context, state) {
              // The card to open on, from the Home's Detalhes; the first
              // when none or one out of range.
              final card = int.tryParse(
                state.uri.queryParameters['card'] ?? '',
              );
              final index =
                  card != null && card >= 0 && card < exampleCards.length
                  ? card
                  : 0;
              return CardsScreen(
                key: ValueKey(index),
                initialIndex: index,
                onBack: () => _back(context),
              );
            },
          ),
          GoRoute(
            path: AppRoutes.menu,
            builder: (context, _) => MenuScreen(onBack: () => _back(context)),
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
          // The key from the Home's Pix box rides as extra, never in the URL.
          initialKey: state.extra is String ? state.extra! as String : null,
          onBack: () => _back(context),
          onReceive: () => context.push(AppRoutes.pixReceive),
          onReview: (id) => context.push(AppRoutes.pixReview(id)),
          onSchedule: (draft) =>
              context.push(AppRoutes.pixScheduleNew, extra: draft),
        ),
      ),
      // The scheduled Pix (v1.2.0 plan, task 7): the list over the Home;
      // "new" before the id, which would take it.
      GoRoute(
        path: AppRoutes.pixSchedules,
        builder: (context, _) => SchedulesScreen(
          onBack: () => _back(context),
          onSchedule: (id) => context.push(AppRoutes.pixSchedule(id)),
          onNew: () => context.push(AppRoutes.pix),
        ),
      ),
      GoRoute(
        path: AppRoutes.pixScheduleNew,
        builder: (context, state) => NewScheduleScreen(
          draft: state.extra! as ScheduleDraft,
          onBack: () => _back(context),
          onHome: () => context.go(AppRoutes.home),
          // The schedule replaces the flow: back never leads to the PIN.
          onDone: (schedule) {
            context.go(AppRoutes.home);
            unawaited(context.push(AppRoutes.pixSchedules));
            unawaited(context.push(AppRoutes.pixSchedule(schedule.id)));
          },
        ),
      ),
      GoRoute(
        path: AppRoutes.pixSchedule(':scheduleId'),
        builder: (context, state) => ScheduleDetailScreen(
          scheduleId: state.pathParameters['scheduleId'] ?? '',
          onBack: () => _back(context),
          onReceipt: (transferId) =>
              context.push(AppRoutes.pixReceipt(transferId)),
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
          onTopUpReceipt: (topUpId) =>
              context.push(AppRoutes.topUpReceipt(topUpId)),
        ),
      ),
      // The changes open over Security, so back and done return to it.
      GoRoute(
        path: AppRoutes.assistant,
        builder: (context, _) => AssistantScreen(onClose: () => _back(context)),
      ),
      GoRoute(
        path: AppRoutes.topUps,
        builder: (context, _) => TopUpOperatorsScreen(
          onBack: () => _back(context),
          onOperator: (operator) =>
              context.push(AppRoutes.topUpAmount, extra: operator),
        ),
      ),
      GoRoute(
        path: AppRoutes.topUpAmount,
        // Opened only from the operators, which always send one; deep links
        // are off (MOB-06).
        builder: (context, state) => TopUpAmountScreen(
          operator: state.extra! as TopUpOperator,
          onBack: () => _back(context),
          onContinue: (draft) =>
              context.push(AppRoutes.topUpConfirm, extra: draft),
        ),
      ),
      GoRoute(
        path: AppRoutes.topUpConfirm,
        builder: (context, state) => ConfirmTopUpScreen(
          draft: state.extra! as TopUpDraft,
          onBack: () => _back(context),
          onHome: () => context.go(AppRoutes.home),
          // The receipt replaces the flow: back never leads to the PIN.
          onDone: (topUp) => context.go(AppRoutes.topUpReceipt(topUp.id)),
        ),
      ),
      GoRoute(
        path: AppRoutes.topUpReceipt(':topUpId'),
        builder: (context, state) => TopUpReceiptScreen(
          topUpId: state.pathParameters['topUpId'] ?? '',
          // Pushed from a statement detail, back returns to it; after a
          // top-up just done nothing is below, so it goes home.
          onClose: () => _back(context),
          onHome: () => context.go(AppRoutes.home),
        ),
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
