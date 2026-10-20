import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/recharge/presentation/amount/recharge_amount_screen.dart';
import 'package:next_bank/features/recharge/presentation/recharge_screen.dart';

import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

Future<void> back(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Voltar'));
  await tester.pumpAndSettle();
}

// The recharges through the real router (v1.1.0 plan, task 4.12): each
// screen goes back to the one below it.
void main() {
  testWidgets('opens a carrier from the Home shortcut, and back each step', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    await pumpApp(tester, store: FakeTokenStore(tokens));
    await unlockWithPin(tester);

    await tester.tap(find.widgetWithText(ActionTile, 'Recarga'));
    await tester.pumpAndSettle();
    expect(find.byType(RechargeScreen), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Vivo'));
    await tester.pumpAndSettle();
    expect(find.byType(RechargeAmountScreen), findsOneWidget);
    expect(find.text('Recarga de celular Vivo'), findsOneWidget);

    await back(tester);
    expect(find.byType(RechargeScreen), findsOneWidget);
    await back(tester);
    expect(find.byType(HomeScreen), findsOneWidget);
  });
}
