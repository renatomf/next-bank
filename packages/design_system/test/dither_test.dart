import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Found on the emulator: Impeller does not dither gradients, so the faint
// screen glow and the balance card's silk showed rings. A fine grain sits
// over each gradient and under the content.
void main() {
  testWidgets('sits over the balance card silk', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: BalanceCard(
            accountNumber: '100000-4',
            balanceCents: 1000000,
            hidden: false,
            onToggleHidden: () {},
          ),
        ),
      ),
    );

    expect(
      find.descendant(
        of: find.byType(BalanceCard),
        matching: find.byType(Dither),
      ),
      findsOneWidget,
    );
  });
}
