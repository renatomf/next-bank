import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// A Home shortcut takes any widget as its icon, such as the Pix symbol
// (week 8 plan, V6 and V7); a plain icon keeps the accent color.
void main() {
  Future<void> pumpTile(WidgetTester tester, Widget icon) => tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: Scaffold(
        body: ActionTile(icon: icon, label: 'Área Pix', onPressed: () {}),
      ),
    ),
  );

  testWidgets('shows a widget as its icon', (tester) async {
    await pumpTile(tester, const PixMark());

    expect(find.byType(PixMark), findsOneWidget);
    expect(find.bySemanticsLabel('Área Pix'), findsOneWidget);
  });

  testWidgets('paints a plain icon in the accent color', (tester) async {
    await pumpTile(tester, const Icon(Icons.qr_code_scanner));

    final context = tester.element(find.byIcon(Icons.qr_code_scanner));
    expect(IconTheme.of(context).color, NbColors.dark.accent);
  });
}
