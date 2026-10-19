import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

// The profile's menus (v1.1.0 plan, task 4.4): rows of an icon, a title and
// an arrow, in one card, split by lines.
void main() {
  Future<void> pumpGroup(WidgetTester tester, List<Widget> rows) =>
      tester.pumpWidget(
        MaterialApp(
          theme: NbTheme.dark(),
          home: Scaffold(body: MenuGroup(children: rows)),
        ),
      );

  testWidgets('runs a row when tapped, read as one button', (tester) async {
    var taps = 0;
    await pumpGroup(tester, [
      MenuRow(
        icon: Icons.dark_mode_outlined,
        title: 'Tema do app',
        onTap: () => taps++,
      ),
    ]);

    await tester.tap(find.bySemanticsLabel('Tema do app'));

    expect(taps, 1);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Tema do app')),
      isSemantics(label: 'Tema do app', isButton: true, hasTapAction: true),
    );
    expect(find.byIcon(Icons.chevron_right), findsOneWidget);
  });

  testWidgets('splits the rows by a line between each two', (tester) async {
    await pumpGroup(tester, [
      for (final title in ['Trocar PIN', 'Trocar senha', 'Aparelhos'])
        MenuRow(icon: Icons.lock_outline, title: title, onTap: () {}),
    ]);

    expect(find.byType(Divider), findsNWidgets(2));
  });

  // A choice, as in the theme screen: a check in place of the arrow, and
  // screen readers hear which one is on.
  testWidgets('marks a selected row with a check, announced', (tester) async {
    await pumpGroup(tester, [
      MenuRow(
        icon: Icons.dark_mode_outlined,
        title: 'Escuro',
        selected: true,
        onTap: () {},
      ),
      MenuRow(
        icon: Icons.light_mode_outlined,
        title: 'Claro',
        selected: false,
        onTap: () {},
      ),
    ]);

    expect(find.byIcon(Icons.check), findsOneWidget);
    expect(find.byIcon(Icons.chevron_right), findsNothing);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Escuro')),
      isSemantics(
        label: 'Escuro',
        isButton: true,
        isSelected: true,
        hasSelectedState: true,
        isInMutuallyExclusiveGroup: true,
        hasTapAction: true,
      ),
    );
  });

  // The help's questions (task 4.5): text and arrow, no icon.
  testWidgets('shows a row without an icon', (tester) async {
    await pumpGroup(tester, [
      MenuRow(title: 'Como fazer um Pix?', onTap: () {}),
    ]);

    expect(find.text('Como fazer um Pix?'), findsOneWidget);
    expect(find.byType(Icon), findsOneWidget);
    expect(find.byIcon(Icons.chevron_right), findsOneWidget);
  });
}
