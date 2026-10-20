import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/help/presentation/help_screen.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

// The help through the real router (v1.1.0 plan, task 4.5).
void main() {
  testWidgets('opens the help from the Home, and back returns to it', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    await pumpApp(tester, store: FakeTokenStore(tokens));
    await unlockWithPin(tester);

    await tester.tap(find.bySemanticsLabel('Ajuda'));
    await tester.pumpAndSettle();
    expect(find.byType(HelpScreen), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Voltar'));
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
  });
}
