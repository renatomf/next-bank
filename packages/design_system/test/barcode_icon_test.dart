import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// A barcode drawn as an icon, for "Pagar" (S21 checkpoint of v1.1.0): the
// Material icons only have a barcode reader. Drawn in code, no dependency.
void main() {
  Future<void> pumpIcon(WidgetTester tester, Widget icon) => tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: Scaffold(body: Center(child: icon)),
    ),
  );

  testWidgets('takes the size and color of the icon theme, as an Icon', (
    tester,
  ) async {
    await pumpIcon(
      tester,
      const IconTheme(
        data: IconThemeData(size: 30, color: Color(0xFF123456)),
        child: BarcodeIcon(),
      ),
    );

    expect(tester.getSize(find.byType(BarcodeIcon)), const Size(30, 30));
    final paint = tester.widget<CustomPaint>(
      find.descendant(
        of: find.byType(BarcodeIcon),
        matching: find.byType(CustomPaint),
      ),
    );
    expect((paint.painter! as BarcodePainter).color, const Color(0xFF123456));
  });

  testWidgets('takes the size asked over the theme', (tester) async {
    await pumpIcon(tester, const BarcodeIcon(size: 18));

    expect(tester.getSize(find.byType(BarcodeIcon)), const Size(18, 18));
  });
}
