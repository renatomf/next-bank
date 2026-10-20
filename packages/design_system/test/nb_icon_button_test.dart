import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// A plain icon button, without the circle of IconCircleButton, read by
// screen readers by what it does (v1.1.0 plan, tasks 4.8 and 4.9).
void main() {
  testWidgets('is read as one button by its label, and taps', (tester) async {
    var taps = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: NbIconButton(
            icon: Icons.star_border,
            label: 'Favoritar',
            onPressed: () => taps++,
          ),
        ),
      ),
    );

    await tester.tap(find.bySemanticsLabel('Favoritar'));

    expect(taps, 1);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Favoritar')),
      isSemantics(label: 'Favoritar', isButton: true, hasTapAction: true),
    );
  });
}
