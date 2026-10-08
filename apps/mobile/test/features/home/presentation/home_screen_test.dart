import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

import '../../../support/fake_account_repository.dart';
import '../../../support/fake_profile_repository.dart';
import '../../../support/fake_token_store.dart';

Future<void> pumpHome(
  WidgetTester tester, {
  FakeAccountRepository? account,
  DateTime? now,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
        profileRepositoryProvider.overrideWithValue(FakeProfileRepository()),
        accountRepositoryProvider.overrideWithValue(
          account ?? FakeAccountRepository(),
        ),
        nowProvider.overrideWithValue(() => now ?? DateTime(2026, 10, 7, 9)),
      ],
      child: MaterialApp(
        theme: NbTheme.dark(),
        home: HomeScreen(onPix: () {}),
      ),
    ),
  );
}

// Screen 6, Home (domain-model.md, section 11): skeleton, ready, hidden
// balance and error; mockups home-dark and home-light.
void main() {
  testWidgets('shows placeholders while the balance loads', (tester) async {
    final account = FakeAccountRepository();
    final gate = Completer<void>();
    account.answer = () => gate.future;
    await pumpHome(tester, account: account);
    await tester.pump();

    expect(find.bySemanticsLabel('Carregando saldo'), findsOneWidget);

    gate.complete();
    await tester.pumpAndSettle();
  });

  testWidgets('greets the customer and shows the available balance', (
    tester,
  ) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    expect(find.text('Bom dia,'), findsOneWidget);
    expect(find.text('Ana Souza'), findsOneWidget);
    expect(find.byType(DisplayTitle), findsOneWidget);
    expect(find.text('Saldo disponível · Conta •••• 0004'), findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  // MOB-05: the customer can hide the balance from someone beside them.
  testWidgets('hides the balance and shows it again', (tester) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Ocultar saldo'));
    await tester.pump();

    expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsNothing);

    await tester.tap(find.bySemanticsLabel('Mostrar saldo'));
    await tester.pump();

    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  testWidgets('says the balance could not load and tries again', (
    tester,
  ) async {
    final account = FakeAccountRepository();
    var calls = 0;
    account.answer = () async {
      if (calls++ == 0) throw const ApiUnreachable();
    };
    await pumpHome(tester, account: account);
    await tester.pumpAndSettle();

    expect(find.text('Não foi possível carregar seu saldo.'), findsOneWidget);

    await tester.tap(find.text('Tentar de novo'));
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
    expect(account.fetches, 2);
  });

  for (final (hour, greeting) in [
    (5, 'Bom dia,'),
    (11, 'Bom dia,'),
    (12, 'Boa tarde,'),
    (17, 'Boa tarde,'),
    (18, 'Boa noite,'),
    (23, 'Boa noite,'),
    (0, 'Boa noite,'),
  ]) {
    testWidgets('says "$greeting" at $hour h', (tester) async {
      await pumpHome(tester, now: DateTime(2026, 10, 7, hour));
      await tester.pumpAndSettle();

      expect(find.text(greeting), findsOneWidget);
    });
  }

  testWidgets('fits a small phone at 1.3x text', (tester) async {
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await pumpHome(tester);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
