import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/assistant/presentation/assistant_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

// The assistant through the real router (v1.1.0 plan, task 4.10).
void main() {
  testWidgets('opens from the help field, and its X returns to the Home', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    await pumpApp(tester, store: FakeTokenStore(tokens));
    await unlockWithPin(tester);

    await tester.tap(find.text('Posso te ajudar?'));
    await tester.pumpAndSettle();
    expect(find.byType(AssistantScreen), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Fechar'));
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
  });
}
