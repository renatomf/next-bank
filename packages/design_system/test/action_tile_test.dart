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

  // S21 checkpoint of v1.1.0: every shortcut's icon in one size, the Pix
  // symbol included.
  for (final (name, icon, type) in [
    ('the Pix symbol', const PixMark(size: 40) as Widget, PixMark),
    ('a plain icon', const Icon(Icons.qr_code_2), Icon),
  ]) {
    testWidgets('draws $name in the shortcut icon size', (tester) async {
      await pumpTile(tester, icon);

      expect(
        tester.getSize(find.byType(type)),
        const Size.square(ActionTile.iconSize),
      );
    });
  }

  // Week 8 plan, V13: a long label stays on one line in a narrow tile.
  testWidgets('keeps a long label on one line', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 64,
              child: ActionTile(
                icon: const Icon(Icons.swap_horiz),
                label: 'Transferir',
                onPressed: () {},
              ),
            ),
          ),
        ),
      ),
    );

    expect(tester.widget<Text>(find.text('Transferir')).maxLines, 1);
    expect(tester.takeException(), isNull);
  });
}
