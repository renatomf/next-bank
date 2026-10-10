import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The floating navigation of the home-dark mockup (brief, sections 7 and 8).
void main() {
  Future<({List<int> selected, List<String> actions})> pumpBar(
    WidgetTester tester, {
    int? selectedIndex = 0,
  }) async {
    final selected = <int>[];
    final actions = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(20),
            child: Align(
              alignment: Alignment.bottomCenter,
              child: FloatingNavBar(
                leading: const [
                  (icon: Icons.home_outlined, label: 'Início'),
                  (icon: Icons.list, label: 'Extrato'),
                ],
                trailing: const [
                  (icon: Icons.shield_outlined, label: 'Segurança'),
                  (icon: Icons.person_outline, label: 'Perfil'),
                ],
                action: (icon: Icons.diamond_outlined, label: 'Pix'),
                selectedIndex: selectedIndex,
                onSelected: selected.add,
                onAction: () => actions.add('pix'),
              ),
            ),
          ),
        ),
      ),
    );
    return (selected: selected, actions: actions);
  }

  testWidgets('names every destination and the action', (tester) async {
    await pumpBar(tester);

    for (final label in ['Início', 'Extrato', 'Pix', 'Segurança', 'Perfil']) {
      expect(find.bySemanticsLabel(label), findsOneWidget, reason: label);
    }
  });

  testWidgets('reports the destination tapped, across both sides', (
    tester,
  ) async {
    final bar = await pumpBar(tester);

    await tester.tap(find.bySemanticsLabel('Extrato'));
    await tester.tap(find.bySemanticsLabel('Perfil'));

    expect(bar.selected, [1, 3]);
  });

  testWidgets('runs the main action', (tester) async {
    final bar = await pumpBar(tester);

    await tester.tap(find.bySemanticsLabel('Pix'));

    expect(bar.actions, ['pix']);
    expect(bar.selected, isEmpty);
  });

  // Brief, section 8: the current destination is told to screen readers too.
  testWidgets('marks the current destination as selected', (tester) async {
    await pumpBar(tester, selectedIndex: 2);

    expect(
      tester.getSemantics(find.bySemanticsLabel('Segurança')),
      isSemantics(label: 'Segurança', isSelected: true, isButton: true),
    );
    expect(
      tester.getSemantics(find.bySemanticsLabel('Início')),
      isSemantics(label: 'Início', isSelected: false, isButton: true),
    );
  });

  // Found when the app placed the bar over its screens: outside a Scaffold
  // there was no Material for the taps' ink.
  testWidgets('stands on its own, outside a Scaffold', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Align(
          alignment: Alignment.bottomCenter,
          child: FloatingNavBar(
            leading: const [(icon: Icons.home_outlined, label: 'Início')],
            trailing: const [(icon: Icons.person_outline, label: 'Perfil')],
            action: (icon: Icons.diamond_outlined, label: 'Pix'),
            selectedIndex: 0,
            onSelected: (_) {},
            onAction: () {},
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets('is 72 high, as in the mockup', (tester) async {
    await pumpBar(tester);

    expect(
      tester.getSize(find.byType(FloatingNavBar)).height,
      FloatingNavBar.height,
    );
  });
}
