import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// S21 checkpoint of v1.1.0: the app's icons in one color, the accent green,
// on chips, plain icon buttons and round icon buttons alike.
void main() {
  Future<void> pump(WidgetTester tester, Widget child) => tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: Scaffold(body: Center(child: child)),
    ),
  );

  Color? colorOf(WidgetTester tester, IconData icon) =>
      tester.widget<Icon>(find.byIcon(icon)).color;

  testWidgets("paints a chip's icons green, before and after the label", (
    tester,
  ) async {
    await pump(
      tester,
      NbChip(
        label: 'Escolher agente',
        icon: Icons.help_outline,
        trailingIcon: Icons.expand_more,
        onPressed: () {},
      ),
    );

    expect(colorOf(tester, Icons.help_outline), NbColors.dark.accent);
    expect(colorOf(tester, Icons.expand_more), NbColors.dark.accent);
  });

  testWidgets('paints a plain icon button green', (tester) async {
    await pump(
      tester,
      NbIconButton(icon: Icons.copy_outlined, label: 'Copiar', onPressed: () {}),
    );

    expect(colorOf(tester, Icons.copy_outlined), NbColors.dark.accent);
  });

  testWidgets('paints a round icon button green', (tester) async {
    await pump(
      tester,
      IconCircleButton(icon: Icons.close, label: 'Fechar', onPressed: () {}),
    );

    expect(colorOf(tester, Icons.close), NbColors.dark.accent);
  });
}
