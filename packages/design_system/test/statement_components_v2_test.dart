import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child) => MaterialApp(
  theme: NbTheme.dark(),
  home: Scaffold(
    body: Padding(padding: const EdgeInsets.all(20), child: child),
  ),
);

// The redesigned statement (v1.1.0 plan, task 4.1): the balance card in the
// glass style with its actions, and the filter pills.
void main() {
  // The statement uses the Home's card, with its proportions, plus a row of
  // actions below the glass panel (developer's call at the checkpoint).
  group('BalanceCard with actions', () {
    var pressed = <String>[];
    Widget card() => BalanceCard(
      accountNumber: '100000-4',
      balanceCents: 1268042,
      hidden: false,
      onToggleHidden: () {},
      actions: [
        for (final label in ['Exportar', 'Pagar', 'Fazer Pix'])
          (
            icon: Icons.ios_share,
            label: label,
            onPressed: () => pressed.add(label),
          ),
      ],
    );

    setUp(() => pressed = <String>[]);

    testWidgets('runs each action, in order', (tester) async {
      await tester.pumpWidget(host(card()));

      for (final label in ['Exportar', 'Pagar', 'Fazer Pix']) {
        await tester.tap(find.bySemanticsLabel(label));
      }

      expect(pressed, ['Exportar', 'Pagar', 'Fazer Pix']);
    });

    testWidgets('keeps the actions below the balance, with no box', (
      tester,
    ) async {
      await tester.pumpWidget(host(card()));

      // The balance's glass.
      final glass = find
          .ancestor(
            of: find.bySemanticsLabel(r'R$ 12.680,42'),
            matching: find.byType(BackdropFilter),
          )
          .first;
      expect(
        find.descendant(of: glass, matching: find.bySemanticsLabel('Pagar')),
        findsNothing,
      );
      // No box of their own (developer's call): the tint darkens again at
      // the foot instead, keeping their text AA (accessibility test).
      expect(
        find.ancestor(
          of: find.bySemanticsLabel('Pagar'),
          matching: find.byType(BackdropFilter),
        ),
        findsNothing,
      );
      expect(
        tester.getTopLeft(find.bySemanticsLabel('Pagar')).dy,
        greaterThan(tester.getBottomLeft(glass).dy),
      );
    });

    testWidgets('fits the actions at 1.3x text', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await tester.pumpWidget(host(card()));

      expect(tester.takeException(), isNull);
    });

    testWidgets('shows no actions on the Home, which passes none', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          BalanceCard(
            accountNumber: '100000-4',
            balanceCents: 1268042,
            hidden: false,
            onToggleHidden: () {},
          ),
        ),
      );

      expect(find.bySemanticsLabel('Pagar'), findsNothing);
    });
  });

  group('FilterPill', () {
    Future<void> pump(
      WidgetTester tester, {
      required bool selected,
      VoidCallback? onPressed,
    }) => tester.pumpWidget(
      host(
        Align(
          alignment: Alignment.topLeft,
          child: FilterPill(
            label: 'Entrada',
            icon: Icons.south_west,
            selected: selected,
            onPressed: onPressed ?? () {},
          ),
        ),
      ),
    );

    testWidgets('shows its icon and label while off', (tester) async {
      await pump(tester, selected: false);

      expect(find.byIcon(Icons.south_west), findsOneWidget);
      expect(find.byIcon(Icons.check), findsNothing);
      expect(
        tester.getSemantics(find.byType(FilterPill)),
        isSemantics(isSelected: false),
      );
    });

    testWidgets('takes a check and says it is selected while on', (
      tester,
    ) async {
      await pump(tester, selected: true);

      expect(find.byIcon(Icons.check), findsOneWidget);
      expect(find.byIcon(Icons.south_west), findsNothing);
      expect(
        tester.getSemantics(find.byType(FilterPill)),
        isSemantics(isSelected: true),
      );
    });

    testWidgets('turns on and off on a tap', (tester) async {
      var taps = 0;
      await pump(tester, selected: false, onPressed: () => taps++);

      await tester.tap(find.bySemanticsLabel('Entrada'));

      expect(taps, 1);
    });
  });
}
