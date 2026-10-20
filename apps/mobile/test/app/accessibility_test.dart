import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/session/session_tokens.dart';
import 'package:next_bank/features/assistant/presentation/assistant_screen.dart';
import 'package:next_bank/features/auth/presentation/create_pin/create_pin_screen.dart';
import 'package:next_bank/features/auth/presentation/login/login_screen.dart';
import 'package:next_bank/features/auth/presentation/register/register_screen.dart';
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
import 'package:next_bank/features/pix/presentation/processing/processing_screen.dart';
import 'package:next_bank/features/pix/presentation/receipt/receipt_screen.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/transfer/transfer_pix_screen.dart';
import 'package:next_bank/features/profile/presentation/blank/profile_blank_screen.dart';
import 'package:next_bank/features/profile/presentation/profile_screen.dart';
import 'package:next_bank/features/profile/presentation/theme/theme_screen.dart';
import 'package:next_bank/features/recharge/presentation/recharge_screen.dart';
import 'package:next_bank/features/security/presentation/change_password/change_password_screen.dart';
import 'package:next_bank/features/security/presentation/change_pin/change_pin_screen.dart';
import 'package:next_bank/features/security/presentation/sessions/security_screen.dart';
import 'package:next_bank/features/statement/presentation/detail/statement_detail_screen.dart';
import 'package:next_bank/features/statement/presentation/list/statement_screen.dart';
import 'package:next_bank/features/unlock/presentation/unlock_screen.dart';

import '../support/fake_pix_repository.dart';
import '../support/fake_profile_repository.dart';
import '../support/fake_statement_repository.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

/// A device whose keystore always fails: the Splash offers a retry.
class BrokenTokenStore extends FakeTokenStore {
  @override
  Future<SessionTokens?> read() async =>
      throw PlatformException(code: 'keystore');
}

/// Signed in and unlocked, then straight to [location] through the router.
Future<void> openSignedIn(
  WidgetTester tester,
  String location, {
  FakePixRepository? pix,
  FakeStatementRepository? statement,
}) async {
  await pumpApp(
    tester,
    store: FakeTokenStore(tokens),
    pix: pix,
    statement: statement,
  );
  await unlockWithPin(tester);
  GoRouter.of(tester.element(find.byType(Scaffold).last)).go(location);
  await tester.pumpAndSettle();
}

/// The statement with one movement, so the list and its detail have rows.
FakeStatementRepository oneMovement() => FakeStatementRepository({
  null: () async => (items: [movement('m-1')], nextCursor: null),
});

/// How to reach each screen of the app (domain-model.md 11).
final List<(String, Type, Future<void> Function(WidgetTester))> screens = [
  (
    'Splash',
    SplashScreen,
    (tester) => pumpApp(tester, store: BrokenTokenStore()),
  ),
  ('Login', LoginScreen, (tester) => pumpApp(tester, store: FakeTokenStore())),
  (
    'Registration',
    RegisterScreen,
    (tester) async {
      await pumpApp(tester, store: FakeTokenStore());
      GoRouter.of(tester.element(find.byType(Scaffold).last))
          .go(AppRoutes.register);
      await tester.pumpAndSettle();
    },
  ),
  (
    'PIN creation',
    CreatePinScreen,
    (tester) => pumpApp(
      tester,
      store: FakeTokenStore(tokens),
      profile: FakeProfileRepository(hasPin: false),
    ),
  ),
  (
    'Unlock',
    UnlockScreen,
    (tester) => pumpApp(tester, store: FakeTokenStore(tokens)),
  ),
  (
    'Home',
    HomeScreen,
    (tester) => openSignedIn(tester, AppRoutes.home, statement: oneMovement()),
  ),
  ('Pix', SendPixScreen, (tester) => openSignedIn(tester, AppRoutes.pix)),
  (
    'Pix review',
    ReviewPixScreen,
    (tester) => openSignedIn(tester, AppRoutes.pixReview('pix-1')),
  ),
  (
    'Pix processing',
    ProcessingScreen,
    (tester) => openSignedIn(
      tester,
      AppRoutes.pixProcessing('pix-1'),
      pix: FakePixRepository()
        ..fetchAnswer = () async => pixTransfer(
          status: PixStatus.failed,
          failureReason: PixFailureReason.insufficientFunds,
        ),
    ),
  ),
  (
    'Receipt',
    ReceiptScreen,
    (tester) => openSignedIn(
      tester,
      AppRoutes.pixReceipt('pix-1'),
      pix: FakePixRepository()
        ..fetchAnswer = () async => pixTransfer(
          status: PixStatus.completed,
          endToEndId: 'E00000000202610081732a8F3k9QpZ2x',
        ),
    ),
  ),
  (
    'Statement',
    StatementScreen,
    (tester) =>
        openSignedIn(tester, AppRoutes.statement, statement: oneMovement()),
  ),
  (
    'Statement detail',
    StatementDetailScreen,
    (tester) => openSignedIn(
      tester,
      AppRoutes.statementItem('m-1'),
      statement: oneMovement(),
    ),
  ),
  (
    'Profile',
    ProfileScreen,
    (tester) => openSignedIn(tester, AppRoutes.profile),
  ),
  (
    'Security',
    SecurityScreen,
    (tester) => openSignedIn(tester, AppRoutes.security),
  ),
  (
    'PIN change',
    ChangePinScreen,
    (tester) => openSignedIn(tester, AppRoutes.changePin),
  ),
  (
    'Password change',
    ChangePasswordScreen,
    (tester) => openSignedIn(tester, AppRoutes.changePassword),
  ),
  ('Help', HelpScreen, (tester) => openSignedIn(tester, AppRoutes.help)),
  (
    'Recargas',
    RechargeScreen,
    (tester) => openSignedIn(tester, AppRoutes.recharge),
  ),
  ('Cartões', CardsScreen, (t) => openSignedIn(t, AppRoutes.cards)),
  (
    'Investimentos',
    InvestmentsScreen,
    (tester) => openSignedIn(tester, AppRoutes.investments),
  ),
  ('Menu', MenuScreen, (t) => openSignedIn(t, AppRoutes.menu)),
  (
    'Assistant',
    AssistantScreen,
    (tester) => openSignedIn(tester, AppRoutes.assistant),
  ),
  (
    'Pix Automático',
    PixAutomaticScreen,
    (tester) => openSignedIn(tester, AppRoutes.pixAutomatic),
  ),
  (
    'Minhas chaves',
    PixKeysScreen,
    (tester) => openSignedIn(tester, AppRoutes.pixKeys),
  ),
  (
    'Transferir',
    TransferPixScreen,
    (tester) => openSignedIn(tester, AppRoutes.pixTransfer),
  ),
  (
    'Notifications',
    NotificationsScreen,
    (tester) => openSignedIn(tester, AppRoutes.notifications),
  ),
  (
    'Notification settings',
    NotificationSettingsScreen,
    (tester) => openSignedIn(tester, AppRoutes.notificationSettings),
  ),
  (
    'Theme',
    ThemeScreen,
    (tester) => openSignedIn(tester, AppRoutes.profileTheme),
  ),
  (
    'Blank profile screen',
    ProfileBlankScreen,
    (tester) => openSignedIn(tester, AppRoutes.personalData),
  ),
];

// Brief, section 8, on every screen (week 7 plan, D8): every control named
// for screen readers, touch targets of 48 dp (Android) and 44 pt (iOS), and
// AA contrast of each text over what is actually painted behind it.
void main() {
  // In both themes, which follow the phone by default (D9).
  for (final (name, screen, open) in screens) {
    for (final brightness in Brightness.values) {
      testWidgets('$name meets the accessibility guidelines in '
          '${brightness.name} mode', (tester) async {
        tester.platformDispatcher.platformBrightnessTestValue = brightness;
        addTearDown(tester.platformDispatcher.clearPlatformBrightnessTestValue);
        final semantics = tester.ensureSemantics();
        await open(tester);
        expect(find.byType(screen), findsOneWidget);
        expect(
          Theme.of(tester.element(find.byType(screen))).brightness,
          brightness,
        );

        await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
        await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
        await expectLater(tester, meetsGuideline(iOSTapTargetGuideline));
        await expectLater(tester, meetsGuideline(textContrastGuideline));
        semantics.dispose();
      });
    }
  }

  // The only screen without its own test at 1.3x on a small phone.
  testWidgets('Splash fits a small phone at 1.3x text', (tester) async {
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await pumpApp(tester, store: BrokenTokenStore());

    expect(find.text('Não foi possível abrir sua sessão.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
