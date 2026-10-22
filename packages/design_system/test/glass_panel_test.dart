import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The glass the balance sits on takes the whole width; as a pill it fits
// what it holds (S21 checkpoint of v1.1.0 task 5b, the statement link).
void main() {
  Future<void> pumpPanel(WidgetTester tester, GlassPanel panel) =>
      tester.pumpWidget(
        MaterialApp(
          home: Align(
            alignment: Alignment.topLeft,
            child: SizedBox(
              width: 300,
              child: Align(alignment: Alignment.centerLeft, child: panel),
            ),
          ),
        ),
      );

  testWidgets('takes the whole width by default', (tester) async {
    await pumpPanel(tester, const GlassPanel(child: Text('Saldo')));

    expect(tester.getSize(find.byType(GlassPanel)).width, 300);
  });

  testWidgets('fits what it holds as a pill', (tester) async {
    await pumpPanel(
      tester,
      const GlassPanel(
        expand: false,
        padding: EdgeInsets.zero,
        child: SizedBox(width: 80, height: 20),
      ),
    );

    expect(tester.getSize(find.byType(GlassPanel)).width, lessThan(100));
  });
}
