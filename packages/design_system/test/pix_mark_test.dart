import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The official Pix symbol, by the developer's exception to the rule on
// third-party marks (week 8 plan, V6): drawn from its path, no dependency.
void main() {
  Future<void> pumpMark(WidgetTester tester, {double size = 24}) =>
      tester.pumpWidget(
        MaterialApp(
          theme: NbTheme.dark(),
          home: Scaffold(
            body: Center(child: PixMark(size: size)),
          ),
        ),
      );

  testWidgets('takes the size asked, as a square', (tester) async {
    await pumpMark(tester, size: 32);

    expect(tester.getSize(find.byType(PixMark)), const Size(32, 32));
  });

  testWidgets('is read as "Pix"', (tester) async {
    await pumpMark(tester);

    expect(find.bySemanticsLabel('Pix'), findsOneWidget);
  });

  test('keeps the official color', () {
    expect(PixMark.color, const Color(0xFF32BCAD));
  });
}
