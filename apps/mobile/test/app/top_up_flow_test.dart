import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/receipt_texts.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/top_up/presentation/amount/top_up_amount_screen.dart';
import 'package:next_bank/features/top_up/presentation/confirm/confirm_top_up_screen.dart';
import 'package:next_bank/features/top_up/presentation/operators/top_up_operators_screen.dart';

import '../support/fake_token_store.dart';
import '../support/fake_top_up_repository.dart';
import '../support/pump_app.dart';

Finder listOf(Type type) => find
    .descendant(of: find.byType(type), matching: find.byType(Scrollable))
    .first;

/// Signed in with the PIN, unlocked, on the operators.
Future<void> openTopUps(WidgetTester tester, FakeTopUpRepository topUp) async {
  tester.view.physicalSize = const Size(1080, 3600);
  addTearDown(tester.view.reset);
  await pumpApp(tester, store: FakeTokenStore(tokens), topUp: topUp);
  await unlockWithPin(tester);
  await tester.tap(find.widgetWithText(ActionTile, 'Recarga'));
  await tester.pumpAndSettle();
}

/// From the operators to the confirmation: R$ 30,00 to a made-up number
/// through Pulso Celular.
Future<void> chooseTopUp(
  WidgetTester tester, {
  String phone = '(11) 90000-0001',
}) async {
  await tester.tap(find.bySemanticsLabel('Pulso Celular'));
  await tester.pumpAndSettle();
  await tester.enterText(
    find.descendant(
      of: find.widgetWithText(NbTextField, 'Número do celular'),
      matching: find.byType(TextField),
    ),
    phone,
  );
  await tester.tap(find.text(r'R$ 30'));
  await tester.pump();
  await tester.tap(find.bySemanticsLabel('Continuar'));
  await tester.pumpAndSettle();
}

Future<void> typePin(WidgetTester tester, [String pin = '2580']) async {
  await tester.scrollUntilVisible(
    find.byType(PinField),
    200,
    scrollable: listOf(ConfirmTopUpScreen),
  );
  await tester.enterText(find.byType(PinField), pin);
  await tester.pumpAndSettle();
}

// The top-up through the real router (v1.1.0 plan, task 5b): operators and
// amounts from the server (D6), only a made-up number (TOP-01), the PIN
// checked on the server (PIX-06) and the receipt from the server.
void main() {
  testWidgets('tops up a made-up number with the PIN and shows the receipt', (
    tester,
  ) async {
    final topUp = FakeTopUpRepository();
    await openTopUps(tester, topUp);

    await chooseTopUp(tester);
    expect(find.text('Confirmar recarga'), findsOneWidget);
    expect(find.text('para (11) *****-0001'), findsOneWidget);
    await typePin(tester);

    final call = topUp.callsOf('create').single;
    expect(call.operatorId, 'pulso-celular');
    expect(call.phoneDigits, '11900000001');
    expect(call.amountCents, 3000);
    expect(call.pin, '2580');
    expect(find.text('Recarga feita'), findsOneWidget);
    expect(find.text('Celular (11) *****-0001'), findsOneWidget);
    expect(find.text(demoReceiptNotice), findsOneWidget);

    // Closing the receipt never leads back to the PIN.
    await tester.tap(find.bySemanticsLabel('Fechar'));
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  // D6, R3, F-37: only what the server lists; no real brand, no recents.
  testWidgets('lists only the operators the server sends', (tester) async {
    await openTopUps(tester, FakeTopUpRepository());

    expect(find.byType(TopUpOperatorsScreen), findsOneWidget);
    for (final name in ['Onda Móvel', 'Pulso Celular', 'Rede Nova']) {
      expect(find.bySemanticsLabel(name), findsOneWidget);
    }
    expect(find.text('Recargas recentes'), findsNothing);
    expect(find.textContaining('Vivo'), findsNothing);
  });

  testWidgets('offers a retry when the operators fail', (tester) async {
    final topUp = FakeTopUpRepository()
      ..operatorsAnswer = () async => throw const ApiUnreachable();
    await openTopUps(tester, topUp);

    expect(
      find.text('Não foi possível carregar as operadoras.'),
      findsOneWidget,
    );
    topUp.operatorsAnswer = () async => topUpOperators;
    await tester.tap(find.bySemanticsLabel('Tentar de novo'));
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('Pulso Celular'), findsOneWidget);
  });

  // TOP-01: the notice is always there, and a real number never leaves.
  testWidgets('refuses a real-looking number before any call', (tester) async {
    final topUp = FakeTopUpRepository();
    await openTopUps(tester, topUp);

    await chooseTopUp(tester, phone: '(11) 98765-4321');

    expect(find.byType(TopUpAmountScreen), findsOneWidget);
    expect(find.text(fictitiousNumberNotice), findsOneWidget);
    expect(
      find.text('Use um número fictício: (DD) 90000-XXXX.'),
      findsOneWidget,
    );
    expect(topUp.callsOf('create'), isEmpty);
  });

  testWidgets('continues only once an amount is picked', (tester) async {
    await openTopUps(tester, FakeTopUpRepository());
    await tester.tap(find.bySemanticsLabel('Pulso Celular'));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Continuar'));
    await tester.pumpAndSettle();

    expect(find.byType(TopUpAmountScreen), findsOneWidget);
  });

  testWidgets('says a wrong PIN and lets it be typed again', (tester) async {
    final topUp = FakeTopUpRepository()
      ..createAnswer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );
    await openTopUps(tester, topUp);
    await chooseTopUp(tester);

    await typePin(tester, '7413');

    expect(find.text('PIN incorreto. Restam 4 tentativas.'), findsOneWidget);
    expect(find.byType(PinField), findsOneWidget);
  });

  // MOB-07: a lost answer offers only the same attempt again.
  testWidgets('after a lost answer, tries the same top-up again', (
    tester,
  ) async {
    final topUp = FakeTopUpRepository()
      ..createAnswer = () async => throw const ApiUnreachable();
    await openTopUps(tester, topUp);
    await chooseTopUp(tester);
    await typePin(tester);

    expect(find.byType(PinField), findsNothing);
    expect(find.textContaining('não será feita duas vezes'), findsOneWidget);
    topUp.createAnswer = () async => topUpDone();
    await tester.tap(find.bySemanticsLabel('Tentar de novo'));
    await tester.pumpAndSettle();

    expect(find.text('Recarga feita'), findsOneWidget);
    final keys = topUp.callsOf('create').map((call) => call.idempotencyKey);
    expect(keys.toSet(), hasLength(1));
  });

  // F-39: leaving after a lost answer is said before it happens, and the
  // same top-up opened again offers only the same attempt.
  testWidgets('warns before leaving a top-up whose answer was lost', (
    tester,
  ) async {
    final topUp = FakeTopUpRepository()
      ..createAnswer = () async => throw const ApiUnreachable();
    await openTopUps(tester, topUp);
    await chooseTopUp(tester);
    await typePin(tester);

    await tester.tap(find.bySemanticsLabel('Voltar'));
    await tester.pumpAndSettle();
    expect(find.text('A recarga pode ter sido feita'), findsOneWidget);
    await tester.tap(find.text('Ficar'));
    await tester.pumpAndSettle();
    expect(find.byType(ConfirmTopUpScreen), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Voltar'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sair'));
    await tester.pumpAndSettle();
    expect(find.byType(TopUpAmountScreen), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Continuar'));
    await tester.pumpAndSettle();
    expect(find.byType(PinField), findsNothing);
    expect(find.bySemanticsLabel('Tentar de novo'), findsOneWidget);
  });

  testWidgets('leaves without asking when nothing is pending', (tester) async {
    await openTopUps(tester, FakeTopUpRepository());
    await chooseTopUp(tester);

    await tester.tap(find.bySemanticsLabel('Voltar'));
    await tester.pumpAndSettle();

    expect(find.byType(TopUpAmountScreen), findsOneWidget);
  });
}
