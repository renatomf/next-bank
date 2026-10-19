import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/cards/presentation/cards_screen.dart';
import 'package:next_bank/features/home/presentation/cards_box.dart';

import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

Finder inBox(Finder finder) =>
    find.descendant(of: find.byType(CardsBox), matching: finder);

// The Home's cards box through the real router (v1.1.0 plan, task 4.15).
void main() {
  testWidgets("opens the credit card's details on the cards screen", (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 4800);
    addTearDown(tester.view.reset);
    await pumpApp(tester, store: FakeTokenStore(tokens));
    await unlockWithPin(tester);

    await tester.drag(inBox(find.byType(PageView)), const Offset(-500, 0));
    await tester.pumpAndSettle();
    await tester.tap(inBox(find.widgetWithText(TextButton, 'Detalhes')).last);
    await tester.pumpAndSettle();

    expect(find.byType(CardsScreen), findsOneWidget);
    expect(find.text('Fatura atual'), findsOneWidget);
    expect(
      tester.getSemantics(
        find.descendant(
          of: find.byType(NbNavBar),
          matching: find.bySemanticsLabel('Cartões'),
        ),
      ),
      isSemantics(label: 'Cartões', isSelected: true, isButton: true),
    );
  });
}
