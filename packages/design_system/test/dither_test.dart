import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// Found on the emulator: Impeller does not dither gradients, so the faint
// screen glow showed rings. A fine grain sits over the gradient and under
// the content.
void main() {
  testWidgets('sits over the screen glow', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: const GlowBackground(child: SizedBox.expand()),
      ),
    );

    expect(
      find.descendant(
        of: find.byType(GlowBackground),
        matching: find.byType(Dither),
      ),
      findsOneWidget,
    );
  });
}
