import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const List<NavDestination> leading = [
  (icon: Icons.home_outlined, label: 'Início'),
  (icon: Icons.receipt_long_outlined, label: 'Extrato'),
];
const List<NavDestination> trailing = [
  (icon: Icons.shield_outlined, label: 'Segurança'),
  (icon: Icons.person_outline, label: 'Perfil'),
];
// The action takes any widget, such as the Pix symbol (week 8 plan, V6).
const NavAction action = (icon: PixMark(), label: 'Pix');

// The app's navigation docked at the bottom, each destination with its label
// under the icon (week 8 plan, V4; brief, section 8).
void main() {
  Future<({List<int> selected, List<String> actions})> pumpBar(
    WidgetTester tester, {
    int? selectedIndex = 0,
    double bottomInset = 0,
  }) async {
    final selected = <int>[];
    final actions = <String>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: MediaQuery(
          data: MediaQueryData(padding: EdgeInsets.only(bottom: bottomInset)),
          child: Scaffold(
            body: const SizedBox.expand(),
            bottomNavigationBar: NbNavBar(
              leading: leading,
              trailing: trailing,
              action: action,
              selectedIndex: selectedIndex,
              onSelected: selected.add,
              onAction: () => actions.add('pix'),
            ),
          ),
        ),
      ),
    );
    return (selected: selected, actions: actions);
  }

  testWidgets('shows the label of every destination and the action', (
    tester,
  ) async {
    await pumpBar(tester);

    for (final label in ['Início', 'Extrato', 'Pix', 'Segurança', 'Perfil']) {
      expect(find.text(label), findsOneWidget, reason: label);
      expect(find.bySemanticsLabel(label), findsOneWidget, reason: label);
    }
  });

  testWidgets('reports the destination tapped, across both sides', (
    tester,
  ) async {
    final bar = await pumpBar(tester);

    await tester.tap(find.text('Extrato'));
    await tester.tap(find.text('Perfil'));

    expect(bar.selected, [1, 3]);
  });

  testWidgets('runs the main action', (tester) async {
    final bar = await pumpBar(tester);

    await tester.tap(find.text('Pix'));

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

  // Docked at the bottom, above the phone's own navigation buttons.
  testWidgets('sits at the bottom, clear of the system buttons', (
    tester,
  ) async {
    await pumpBar(tester, bottomInset: 24);

    final screen = tester.getSize(find.byType(Scaffold)).height;
    expect(tester.getRect(find.byType(NbNavBar)).bottom, screen);
    expect(tester.getRect(find.text('Início')).bottom, lessThan(screen - 24));
  });

  testWidgets('fits a small phone at 1.3x text', (tester) async {
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          bottomNavigationBar: NbNavBar(
            leading: leading,
            trailing: trailing,
            action: action,
            selectedIndex: 0,
            onSelected: (_) {},
            onAction: () {},
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
  });

  testWidgets('meets the touch target and contrast guidelines', (tester) async {
    final semantics = tester.ensureSemantics();
    await pumpBar(tester);

    await expectLater(tester, meetsGuideline(androidTapTargetGuideline));
    await expectLater(tester, meetsGuideline(labeledTapTargetGuideline));
    await expectLater(tester, meetsGuideline(textContrastGuideline));
    semantics.dispose();
  });
}
