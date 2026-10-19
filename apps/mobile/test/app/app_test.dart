import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/session/session_end_reason.dart';
import 'package:next_bank/core/session/session_tokens.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/unlock/presentation/unlock_screen.dart';
import 'package:next_bank/main.dart';

import '../support/fake_auth_repository.dart';
import '../support/fake_monotonic_clock.dart';
import '../support/fake_profile_repository.dart';
import '../support/fake_token_store.dart';
import '../support/fake_unlock_repository.dart';
import '../support/pump_app.dart';

/// A device whose keystore fails on the first read only.
class FlakyTokenStore extends FakeTokenStore {
  int reads = 0;

  @override
  Future<SessionTokens?> read() async {
    if (reads++ == 0) throw PlatformException(code: 'keystore');
    return stored;
  }
}

final Finder loginButton = find.widgetWithText(FilledButton, 'Entrar');
final Finder signOutButton = find.bySemanticsLabel('Sair');
final Finder unlockTitle = find.byType(UnlockScreen);
final Finder otherAccountButton = find.text('Entrar com outra conta');

/// The states a phone goes through to the background, in the order Flutter
/// requires.
void goToBackground(WidgetTester tester) => [
  AppLifecycleState.inactive,
  AppLifecycleState.hidden,
  AppLifecycleState.paused,
].forEach(tester.binding.handleAppLifecycleStateChanged);

/// And back to the foreground.
void comeBack(WidgetTester tester) => [
  AppLifecycleState.hidden,
  AppLifecycleState.inactive,
  AppLifecycleState.resumed,
].forEach(tester.binding.handleAppLifecycleStateChanged);

// Navigation rules (domain-model.md, section 10) through the real router.
void main() {
  testWidgets('opens on login without a session', (tester) async {
    await pumpApp(tester, store: FakeTokenStore());

    expect(loginButton, findsOneWidget);
    expect(find.byType(InfoNotice), findsNothing);
  });

  // F-16, PIX-06: whoever picks up the phone with the session open meets the
  // PIN.
  testWidgets('asks for the PIN when it opens with a stored session', (
    tester,
  ) async {
    await pumpApp(tester, store: FakeTokenStore(tokens));

    expect(unlockTitle, findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsNothing);
    expect(otherAccountButton, findsOneWidget);
  });

  testWidgets('reaches home once the server accepts the PIN', (tester) async {
    final unlock = FakeUnlockRepository();
    await pumpApp(tester, store: FakeTokenStore(tokens), unlock: unlock);

    await unlockWithPin(tester);

    expect(unlock.pins, ['2580']);
    await showBalance(tester);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  testWidgets('stays on the Unlock screen after a wrong PIN, saying why', (
    tester,
  ) async {
    final unlock = FakeUnlockRepository()
      ..answer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );
    await pumpApp(tester, store: FakeTokenStore(tokens), unlock: unlock);

    await unlockWithPin(tester, '7413');

    expect(unlockTitle, findsOneWidget);
    expect(find.text('PIN incorreto. Restam 4 tentativas.'), findsOneWidget);
  });

  // Week 6 plan, D6: a locked PIN can only be left behind; the login with the
  // password comes back home.
  testWidgets('offers only to leave when the PIN is locked', (tester) async {
    final store = FakeTokenStore(tokens);
    final unlock = FakeUnlockRepository()
      ..answer = () async => throw const ApiRejected(ApiErrorCode.pinLocked);
    await pumpApp(tester, store: store, unlock: unlock);
    await unlockWithPin(tester, '7413');

    expect(find.text('PIN bloqueado por 30 minutos.'), findsOneWidget);
    expect(find.byType(PinField), findsNothing);
    await tester.tap(otherAccountButton);
    await tester.pumpAndSettle();

    expect(store.stored, isNull);
    expect(loginButton, findsOneWidget);
  });

  // Catalog: PinNotCreated leads to the PIN creation, found by the week 7
  // sweep (D8) only showing the message.
  testWidgets('leads to the PIN creation when the account has no PIN', (
    tester,
  ) async {
    final profile = FakeProfileRepository();
    final unlock = FakeUnlockRepository()
      ..answer = () async {
        profile.hasPin = false;
        throw const ApiRejected(ApiErrorCode.pinNotCreated);
      };
    await pumpApp(
      tester,
      store: FakeTokenStore(tokens),
      profile: profile,
      unlock: unlock,
    );

    await unlockWithPin(tester);

    expect(find.text('Crie seu PIN'), findsOneWidget);
  });

  testWidgets('asks for the PIN again after 5 minutes in the background', (
    tester,
  ) async {
    final clock = FakeMonotonicClock();
    await pumpApp(tester, store: FakeTokenStore(tokens), clock: clock);
    await unlockWithPin(tester);

    goToBackground(tester);
    clock.current += const Duration(minutes: 5);
    comeBack(tester);
    await tester.pumpAndSettle();

    expect(unlockTitle, findsOneWidget);
  });

  testWidgets('stays open after a short trip to the background', (
    tester,
  ) async {
    final clock = FakeMonotonicClock();
    await pumpApp(tester, store: FakeTokenStore(tokens), clock: clock);
    await unlockWithPin(tester);

    goToBackground(tester);
    clock.current += const Duration(minutes: 1);
    comeBack(tester);
    await tester.pumpAndSettle();

    await showBalance(tester);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  testWidgets('logs in and reaches home', (tester) async {
    final repository = FakeAuthRepository(tokens);
    await pumpApp(tester, store: FakeTokenStore(), repository: repository);

    await tester.enterText(find.byType(TextField).at(0), 'ana@example.test');
    await tester.enterText(find.byType(TextField).at(1), 'a long passphrase');
    await tester.tap(loginButton);
    await tester.pumpAndSettle();

    expect(repository.logins.single.email, 'ana@example.test');
    await showBalance(tester);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  testWidgets("logs in with the keyboard's done key", (tester) async {
    final repository = FakeAuthRepository(tokens);
    await pumpApp(tester, store: FakeTokenStore(), repository: repository);

    await tester.enterText(find.byType(TextField).at(0), 'ana@example.test');
    await tester.enterText(find.byType(TextField).at(1), 'a long passphrase');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();

    expect(repository.logins, hasLength(1));
    await showBalance(tester);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  testWidgets('shows the refusal of the API on the login screen', (
    tester,
  ) async {
    final repository = FakeAuthRepository(tokens)
      ..answer = () async =>
          throw const ApiRejected(ApiErrorCode.invalidCredentials);
    await pumpApp(tester, store: FakeTokenStore(), repository: repository);

    await tester.enterText(find.byType(TextField).at(0), 'ana@example.test');
    await tester.enterText(find.byType(TextField).at(1), 'a wrong one');
    await tester.tap(loginButton);
    await tester.pumpAndSettle();

    expect(find.text('E-mail ou senha incorretos.'), findsOneWidget);
    expect(loginButton, findsOneWidget);
  });

  // T3-1 (week 7 plan): signing out lives on the Profile, not on the Home.
  testWidgets('signs out from the profile back to login (AUTH-06)', (
    tester,
  ) async {
    final store = FakeTokenStore(tokens);
    final repository = FakeAuthRepository(tokens);
    await pumpApp(tester, store: store, repository: repository);
    await unlockWithPin(tester);
    expect(signOutButton, findsNothing);

    await tester.tap(find.bySemanticsLabel('Perfil'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Configurações'));
    await tester.pumpAndSettle();
    await tester.ensureVisible(signOutButton);
    await tester.pumpAndSettle();
    await tester.tap(signOutButton);
    await tester.pumpAndSettle();

    expect(repository.logouts, 1);
    expect(store.stored, isNull);
    expect(loginButton, findsOneWidget);
    expect(find.byType(InfoNotice), findsNothing);
  });

  testWidgets('goes back to login, saying why, when the session is revoked', (
    tester,
  ) async {
    final container = await pumpApp(tester, store: FakeTokenStore(tokens));

    await container
        .read(sessionProvider.notifier)
        .signOut(SessionEndReason.revoked);
    await tester.pumpAndSettle();

    expect(loginButton, findsOneWidget);
    expect(find.text('Por segurança, entre novamente.'), findsOneWidget);
  });

  // Registration that stopped before the PIN: the account resumes there,
  // whether the session is restored or started by a new login.
  testWidgets('resumes a stored session without PIN at the PIN creation', (
    tester,
  ) async {
    await pumpApp(
      tester,
      store: FakeTokenStore(tokens),
      profile: FakeProfileRepository(hasPin: false),
    );

    expect(find.text('Crie seu PIN'), findsOneWidget);
  });

  testWidgets('sends a login without PIN to the PIN creation', (tester) async {
    await pumpApp(
      tester,
      store: FakeTokenStore(),
      profile: FakeProfileRepository(hasPin: false),
    );

    await tester.enterText(find.byType(TextField).at(0), 'ana@example.test');
    await tester.enterText(find.byType(TextField).at(1), 'a long passphrase');
    await tester.tap(loginButton);
    await tester.pumpAndSettle();

    expect(find.text('Crie seu PIN'), findsOneWidget);
  });

  testWidgets('offers a retry when the profile cannot be loaded', (
    tester,
  ) async {
    final profile = FakeProfileRepository();
    var calls = 0;
    profile.answer = () async {
      if (calls++ == 0) throw const ApiUnreachable();
    };
    await pumpApp(tester, store: FakeTokenStore(tokens), profile: profile);

    expect(find.text('Sem conexão. Tente de novo.'), findsOneWidget);

    await tester.tap(find.text('Tentar de novo'));
    await tester.pumpAndSettle();

    expect(unlockTitle, findsOneWidget);
    expect(profile.fetches, 2);
  });

  testWidgets('offers a retry when the device storage fails', (tester) async {
    final store = FlakyTokenStore();
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStoreProvider.overrideWithValue(store),
          authRepositoryProvider.overrideWithValue(FakeAuthRepository(tokens)),
        ],
        child: const NextBankApp(),
      ),
    );
    await tester.pump();
    await tester.pump();

    expect(find.text('Não foi possível abrir sua sessão.'), findsOneWidget);

    await tester.tap(find.text('Tentar de novo'));
    await tester.pumpAndSettle();

    expect(loginButton, findsOneWidget);
  });

  // Brief, section 8: system font scale up to 1.3x on a small phone.
  for (final (screen, store, unlocked) in [
    ('login', FakeTokenStore.new, false),
    ('unlock', () => FakeTokenStore(tokens), false),
    ('home', () => FakeTokenStore(tokens), true),
  ]) {
    testWidgets('$screen fits a small phone at 1.3x text', (tester) async {
      tester.view
        ..physicalSize = const Size(320 * 3, 568 * 3)
        ..devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await pumpApp(tester, store: store());
      if (unlocked) await unlockWithPin(tester);

      expect(tester.takeException(), isNull);
    });
  }
}
