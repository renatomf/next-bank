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
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

import '../../../support/device_stores.dart';
import '../../../support/fake_account_repository.dart';
import '../../../support/fake_profile_repository.dart';
import '../../../support/fake_statement_repository.dart';
import '../../../support/fake_token_store.dart';
import '../../../support/pump_app.dart';

Future<void> pumpHome(
  WidgetTester tester, {
  FakeAccountRepository? account,
  FakeStatementRepository? statement,
  DateTime? now,
  VoidCallback? onPix,
  VoidCallback? onPay,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...deviceStoreOverrides(),
        tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
        profileRepositoryProvider.overrideWithValue(FakeProfileRepository()),
        accountRepositoryProvider.overrideWithValue(
          account ?? FakeAccountRepository(),
        ),
        nowProvider.overrideWithValue(() => now ?? DateTime(2026, 10, 7, 9)),
        statementRepositoryProvider.overrideWithValue(
          statement ?? FakeStatementRepository(),
        ),
      ],
      child: MaterialApp(
        theme: NbTheme.dark(),
        home: HomeScreen(
          onPix: onPix ?? () {},
          onPay: onPay ?? () {},
          onStatement: () {},
          onMovement: (_) {},
        ),
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

  testWidgets('shows the customer and the available balance', (tester) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();
    await showBalance(tester);

    expect(find.text('Ana'), findsOneWidget);
    expect(find.text('Saldo disponível · Conta •••• 0004'), findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
  });

  // Week 8 plan, V3 and V8: the profile icon, the first name and the logo on
  // one line; no greeting and no slogan.
  testWidgets('heads the Home with the profile icon, the name and the logo', (
    tester,
  ) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    final name = tester.getCenter(find.text('Ana'));
    final icon = tester.getCenter(find.byIcon(Icons.person_outline));
    // The balance card has its own logo; the header's comes first.
    final logo = tester.getCenter(
      find
          .descendant(
            of: find.byType(HomeScreen),
            matching: find.byType(NextLogo),
          )
          .first,
    );
    expect(icon.dx, lessThan(name.dx));
    expect(logo.dx, greaterThan(name.dx));
    expect((icon.dy - name.dy).abs(), lessThan(30));
    expect((logo.dy - name.dy).abs(), lessThan(30));
    for (final greeting in ['Bom dia,', 'Boa tarde,', 'Boa noite,']) {
      expect(find.text(greeting), findsNothing);
    }
    expect(find.byType(DisplayTitle), findsNothing);
  });

  // Week 8 plan, V6 and V7: four shortcuts; only the Pix opens a screen, the
  // others say they are coming.
  testWidgets('opens the Pix from its shortcut, with its symbol', (
    tester,
  ) async {
    var opened = 0;
    await pumpHome(tester, onPix: () => opened++);
    await tester.pumpAndSettle();

    expect(
      find.descendant(
        of: find.widgetWithText(ActionTile, 'Área Pix'),
        matching: find.byType(PixMark),
      ),
      findsOneWidget,
    );
    await tester.tap(find.text('Área Pix'));
    await tester.pumpAndSettle();

    expect(opened, 1);
  });

  // v1.1.0 plan, task 4: "Pagar" reads a Pix QR Code.
  testWidgets('opens the QR Code reading on "Pagar"', (tester) async {
    var paid = 0;
    await pumpHome(tester, onPay: () => paid++);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Pagar'));
    await tester.pumpAndSettle();

    expect(paid, 1);
    expect(find.widgetWithText(NbToast, 'Em breve.'), findsNothing);
  });

  for (final shortcut in ['Transferir', 'Recarga']) {
    testWidgets('says "$shortcut" is coming, without leaving', (tester) async {
      var opened = 0;
      await pumpHome(tester, onPix: () => opened++);
      await tester.pumpAndSettle();

      await tester.tap(find.text(shortcut));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
      expect(opened, 0);
    });
  }

  // Week 8 plan, V11: help and notifications beside the help field.
  for (final button in ['Ajuda', 'Notificações']) {
    testWidgets('says "$button" is coming', (tester) async {
      await pumpHome(tester);
      await tester.pumpAndSettle();

      await tester.tap(find.bySemanticsLabel(button));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
    });
  }

  // Week 8 plan, V13: the four shortcuts share one size, labels on one line.
  testWidgets('lays the shortcuts out in one size', (tester) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    final sizes = tester
        .widgetList(find.byType(ActionTile))
        .map((tile) => tester.getSize(find.byWidget(tile)))
        .toSet();
    expect(sizes, hasLength(1));
  });

  // Week 8 plan, V9: the help field is a button that says it is coming.
  testWidgets('says the assistant is coming', (tester) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    await tester.tap(find.text('Posso te ajudar?'));
    await tester.pumpAndSettle();

    expect(
      find.widgetWithText(NbToast, 'Em breve: assistente com IA.'),
      findsOneWidget,
    );
  });

  // MOB-05, week 8 plan V14: the balance starts hidden at every opening, and
  // the eye shows it and hides it again.
  testWidgets('starts with the balance hidden, and the eye toggles it', (
    tester,
  ) async {
    await pumpHome(tester);
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsNothing);

    await tester.tap(find.bySemanticsLabel('Mostrar saldo'));
    await tester.pump();
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Ocultar saldo'));
    await tester.pump();
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsNothing);
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

    await showBalance(tester);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
    expect(account.fetches, 2);
  });

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
