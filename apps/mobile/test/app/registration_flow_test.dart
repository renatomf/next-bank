import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/cpf.dart';

import '../support/fake_auth_repository.dart';
import '../support/fake_profile_repository.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

/// An account just registered: the server holds no PIN for it yet.
FakeProfileRepository newAccount() => FakeProfileRepository(hasPin: false);

final Finder createAccountButton = find.widgetWithText(
  FilledButton,
  'Criar conta',
);

/// The CPF shown in the registration's read-only field, as digits.
String shownCpf(WidgetTester tester) {
  final field = tester.widget<TextField>(
    find.descendant(
      of: find.widgetWithText(NbTextField, 'CPF fictício'),
      matching: find.byType(TextField),
    ),
  );
  return field.controller!.text.replaceAll(RegExp(r'\D'), '');
}

/// Scrolls the screen's list until [finder] is built and visible: lists
/// build only what is on screen.
Future<void> reveal(WidgetTester tester, Finder finder) async {
  await tester.scrollUntilVisible(
    finder,
    100,
    scrollable: find.byType(Scrollable).first,
  );
  // Fully on screen, not just its first pixels, so taps land on it.
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
}

Future<void> openRegistration(WidgetTester tester) async {
  final link = find.widgetWithText(TextButton, 'Criar conta');
  await reveal(tester, link);
  await tester.tap(link);
  await tester.pumpAndSettle();
}

Future<void> fillAndSubmitRegistration(WidgetTester tester) async {
  await reveal(tester, find.widgetWithText(NbTextField, 'Nome completo'));
  await tester.enterText(
    find.widgetWithText(NbTextField, 'Nome completo'),
    'Ana Souza',
  );
  await tester.enterText(
    find.widgetWithText(NbTextField, 'E-mail'),
    'ana@example.test',
  );
  await reveal(tester, find.widgetWithText(NbTextField, 'Senha'));
  await tester.enterText(
    find.widgetWithText(NbTextField, 'Senha'),
    'a long passphrase',
  );
  await reveal(tester, createAccountButton);
  await tester.tap(createAccountButton);
  await tester.pumpAndSettle();
}

Future<void> enterPin(WidgetTester tester, String pin) async {
  await tester.enterText(find.byType(PinField), pin);
  await tester.pumpAndSettle();
}

// Screens 3 and 4 (domain-model.md, sections 10 and 11) through the real
// router: registration always continues to the PIN, then to the home.
void main() {
  testWidgets('opens the registration from login and goes back', (
    tester,
  ) async {
    await pumpApp(tester, store: FakeTokenStore(), profile: newAccount());

    await openRegistration(tester);
    await reveal(tester, createAccountButton);
    expect(createAccountButton, findsOneWidget);

    await reveal(tester, find.text('Já tenho conta'));
    await tester.tap(find.text('Já tenho conta'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(FilledButton, 'Entrar'), findsOneWidget);
  });

  // DEMO-01: a valid CPF drawn by the app, which nobody can type over.
  testWidgets('shows a fictitious CPF and the demo notice', (tester) async {
    await pumpApp(tester, store: FakeTokenStore(), profile: newAccount());
    await openRegistration(tester);
    await reveal(tester, find.text('Gerar outro'));

    expect(isValidCpf(shownCpf(tester)), isTrue);
    expect(find.textContaining('Demonstração'), findsOneWidget);
    final cpfField = find.descendant(
      of: find.widgetWithText(NbTextField, 'CPF fictício'),
      matching: find.byType(TextField),
    );
    expect(tester.widget<TextField>(cpfField).readOnly, isTrue);
  });

  testWidgets('draws another CPF on "Gerar outro"', (tester) async {
    await pumpApp(tester, store: FakeTokenStore(), profile: newAccount());
    await openRegistration(tester);
    await reveal(tester, find.text('Gerar outro'));
    final first = shownCpf(tester);

    await tester.tap(find.text('Gerar outro'));
    await tester.pump();

    expect(shownCpf(tester), isNot(first));
    expect(isValidCpf(shownCpf(tester)), isTrue);
  });

  testWidgets('registers with the CPF on screen and asks for the PIN', (
    tester,
  ) async {
    final repository = FakeAuthRepository(tokens);
    await pumpApp(
      tester,
      store: FakeTokenStore(),
      repository: repository,
      profile: newAccount(),
    );
    await openRegistration(tester);
    await reveal(tester, find.text('Gerar outro'));
    final cpf = shownCpf(tester);

    await fillAndSubmitRegistration(tester);

    expect(repository.registrations.single.cpf, cpf);
    expect(find.text('Crie seu PIN'), findsOneWidget);
  });

  testWidgets('creates the PIN in two steps and reaches the home', (
    tester,
  ) async {
    final repository = FakeAuthRepository(tokens);
    await pumpApp(
      tester,
      store: FakeTokenStore(),
      repository: repository,
      profile: newAccount(),
    );
    await openRegistration(tester);
    await fillAndSubmitRegistration(tester);

    await enterPin(tester, '2580');
    expect(find.text('Confirme seu PIN'), findsOneWidget);
    await enterPin(tester, '2580');

    expect(repository.pins, ['2580']);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  testWidgets('refuses a trivial PIN at the first step', (tester) async {
    final repository = FakeAuthRepository(tokens);
    await pumpApp(
      tester,
      store: FakeTokenStore(),
      repository: repository,
      profile: newAccount(),
    );
    await openRegistration(tester);
    await fillAndSubmitRegistration(tester);

    await enterPin(tester, '1234');

    expect(find.text('Crie seu PIN'), findsOneWidget);
    expect(
      find.text('Use 4 dígitos que não sejam repetidos nem em sequência.'),
      findsOneWidget,
    );
    expect(repository.pins, isEmpty);
  });

  testWidgets('starts over when the confirmation differs', (tester) async {
    final repository = FakeAuthRepository(tokens);
    await pumpApp(
      tester,
      store: FakeTokenStore(),
      repository: repository,
      profile: newAccount(),
    );
    await openRegistration(tester);
    await fillAndSubmitRegistration(tester);

    await enterPin(tester, '2580');
    await enterPin(tester, '2581');

    expect(find.text('Crie seu PIN'), findsOneWidget);
    expect(find.text('Os PINs não conferem. Digite de novo.'), findsOneWidget);
    expect(repository.pins, isEmpty);
  });

  // Brief, section 8: system font scale up to 1.3x on a small phone.
  for (final (screen, open) in [
    ('registration', openRegistration),
    (
      'PIN creation',
      (WidgetTester tester) async {
        await openRegistration(tester);
        await fillAndSubmitRegistration(tester);
      },
    ),
  ]) {
    testWidgets('$screen fits a small phone at 1.3x text', (tester) async {
      tester.view
        ..physicalSize = const Size(320 * 3, 568 * 3)
        ..devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await pumpApp(tester, store: FakeTokenStore(), profile: newAccount());

      await open(tester);

      expect(tester.takeException(), isNull);
    });
  }
}
