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
import 'package:next_bank/main.dart';

import '../support/fake_auth_repository.dart';
import '../support/fake_profile_repository.dart';
import '../support/fake_token_store.dart';
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

// Navigation rules (domain-model.md, section 10) through the real router.
void main() {
  testWidgets('opens on login without a session', (tester) async {
    await pumpApp(tester, store: FakeTokenStore());

    expect(loginButton, findsOneWidget);
    expect(find.byType(InfoNotice), findsNothing);
  });

  testWidgets('opens on home with a stored session', (tester) async {
    await pumpApp(tester, store: FakeTokenStore(tokens));

    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
    expect(signOutButton, findsOneWidget);
  });

  testWidgets('logs in and reaches home', (tester) async {
    final repository = FakeAuthRepository(tokens);
    await pumpApp(tester, store: FakeTokenStore(), repository: repository);

    await tester.enterText(find.byType(TextField).at(0), 'ana@example.test');
    await tester.enterText(find.byType(TextField).at(1), 'a long passphrase');
    await tester.tap(loginButton);
    await tester.pumpAndSettle();

    expect(repository.logins.single.email, 'ana@example.test');
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

  testWidgets('signs out from home back to login (AUTH-06)', (tester) async {
    final store = FakeTokenStore(tokens);
    final repository = FakeAuthRepository(tokens);
    await pumpApp(tester, store: store, repository: repository);

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

    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
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
  for (final (screen, store) in [
    ('login', FakeTokenStore.new),
    ('home', () => FakeTokenStore(tokens)),
  ]) {
    testWidgets('$screen fits a small phone at 1.3x text', (tester) async {
      tester.view
        ..physicalSize = const Size(320 * 3, 568 * 3)
        ..devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await pumpApp(tester, store: store());

      expect(tester.takeException(), isNull);
    });
  }
}
