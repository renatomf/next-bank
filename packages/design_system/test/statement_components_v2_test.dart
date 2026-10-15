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
  group('StatementBalanceCard', () {
    var pressed = <String>[];
    Widget card({int? cents = 1268042, bool hidden = false}) =>
        StatementBalanceCard(
          accountNumber: cents == null ? null : '100000-4',
          balanceCents: cents,
          hidden: hidden,
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

    // As on the Home's card (developer's call at the checkpoint): the
    // available balance with the masked account, aligned to the start.
    testWidgets('shows the available balance and the masked account', (
      tester,
    ) async {
      await tester.pumpWidget(host(card()));

      expect(find.text('Saldo disponível · Conta •••• 0004'), findsOneWidget);
      expect(find.bySemanticsLabel(r'R$ 12.680,42'), findsOneWidget);
      expect(find.byType(GlassArt), findsOneWidget);
    });

    // As on the Home's card (developer's call at the checkpoint): the
    // balance sits on the frosted glass panel, the actions outside it.
    testWidgets('puts the label and the balance on the glass panel', (
      tester,
    ) async {
      await tester.pumpWidget(host(card()));

      final glass = find.byType(BackdropFilter);
      expect(glass, findsOneWidget);
      expect(
        find.descendant(
          of: glass,
          matching: find.text('Saldo disponível · Conta •••• 0004'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: glass,
          matching: find.bySemanticsLabel(r'R$ 12.680,42'),
        ),
        findsOneWidget,
      );
      expect(
        find.descendant(of: glass, matching: find.bySemanticsLabel('Pagar')),
        findsNothing,
      );
    });

    testWidgets('hides the balance when the customer hid it (MOB-05)', (
      tester,
    ) async {
      await tester.pumpWidget(host(card(hidden: true)));

      expect(find.textContaining('12.680'), findsNothing);
      expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
    });

    testWidgets('shows a placeholder while the balance loads', (tester) async {
      await tester.pumpWidget(host(card(cents: null)));

      expect(find.byType(Skeleton), findsOneWidget);
    });

    testWidgets('runs each action, in order', (tester) async {
      await tester.pumpWidget(host(card()));

      for (final label in ['Exportar', 'Pagar', 'Fazer Pix']) {
        await tester.tap(find.bySemanticsLabel(label));
      }

      expect(pressed, ['Exportar', 'Pagar', 'Fazer Pix']);
    });

    testWidgets('fits the actions at 1.3x text', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await tester.pumpWidget(host(card()));

      expect(tester.takeException(), isNull);
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
