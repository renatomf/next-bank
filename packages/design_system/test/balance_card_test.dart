import 'dart:math';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child, {ThemeData? theme}) => MaterialApp(
  theme: theme ?? NbTheme.dark(),
  home: Scaffold(
    body: Padding(padding: const EdgeInsets.all(20), child: child),
  ),
);

double contrast(Color a, Color b) {
  final la = a.computeLuminance();
  final lb = b.computeLuminance();
  return (max(la, lb) + 0.05) / (min(la, lb) + 0.05);
}

// The balance card, the signature of the Home (brief, sections 2.3 and 7;
// mockups home-dark and home-light): always dark, with the balance on a
// glass panel and an eye to hide it (MOB-05).
void main() {
  group('BalanceCard', () {
    testWidgets('shows the available balance and the masked account', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          BalanceCard(
            accountNumber: '100000-4',
            balanceCents: 1000000,
            hidden: false,
            onToggleHidden: () {},
          ),
        ),
      );

      expect(find.text('Saldo disponível · Conta •••• 0004'), findsOneWidget);
      expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
      expect(find.byType(NextLogo), findsOneWidget);
      // The full number never shows on the card.
      expect(find.textContaining('100000'), findsNothing);
    });

    testWidgets('offers to hide the balance, and asks the screen to', (
      tester,
    ) async {
      var toggles = 0;
      await tester.pumpWidget(
        host(
          BalanceCard(
            accountNumber: '100000-4',
            balanceCents: 1000000,
            hidden: false,
            onToggleHidden: () => toggles++,
          ),
        ),
      );

      await tester.tap(find.bySemanticsLabel('Ocultar saldo'));

      expect(toggles, 1);
    });

    // MOB-05.
    testWidgets('hidden, shows no digit of the balance and offers to show it', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          BalanceCard(
            accountNumber: '100000-4',
            balanceCents: 1000000,
            hidden: true,
            onToggleHidden: () {},
          ),
        ),
      );

      expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
      expect(find.bySemanticsLabel('Mostrar saldo'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'10\.000')), findsNothing);
    });

    testWidgets('while loading, shows placeholders instead of numbers', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          BalanceCard(
            accountNumber: null,
            balanceCents: null,
            hidden: false,
            onToggleHidden: () {},
          ),
        ),
      );

      expect(find.byType(Skeleton), findsWidgets);
      expect(find.byType(MoneyText), findsNothing);
      expect(find.bySemanticsLabel('Carregando saldo'), findsOneWidget);
    });

    testWidgets('is the same dark card in the light theme (brief 2.3)', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          BalanceCard(
            accountNumber: '100000-4',
            balanceCents: 1000000,
            hidden: false,
            onToggleHidden: () {},
          ),
          theme: NbTheme.light(),
        ),
      );

      final money = tester.widget<RichText>(
        find.descendant(
          of: find.byType(MoneyText),
          matching: find.byType(RichText),
        ),
      );
      final integer = (money.text as TextSpan).children![1] as TextSpan;
      expect(integer.style!.color, NbBalanceCardColors.text);
    });

    testWidgets('fits a small phone at 1.3x text', (tester) async {
      tester.view
        ..physicalSize = const Size(320 * 3, 568 * 3)
        ..devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.view.reset);
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await tester.pumpWidget(
        host(
          BalanceCard(
            accountNumber: '999999-9',
            balanceCents: 123456789,
            hidden: false,
            onToggleHidden: () {},
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });
  });

  // Brief, section 8: AA on every text. The glass panel sits over the card's
  // brightest mint light in the worst case, so contrast is checked there.
  group('balance card contrast (AA)', () {
    final worstGround = Color.alphaBlend(
      NbBalanceCardColors.glass,
      NbBrand.mint,
    );
    for (final (name, color) in [
      ('balance', NbBalanceCardColors.text),
      ('label', NbBalanceCardColors.textMuted),
    ]) {
      test('$name on the glass over the mint light', () {
        expect(contrast(color, worstGround), greaterThanOrEqualTo(4.5));
      });
    }
  });
}
