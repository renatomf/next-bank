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

      expect(find.text('Saldo disponível'), findsOneWidget);
      expect(find.text('Conta •••• 0004'), findsOneWidget);
      expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
      // Week 8 plan, V12: the Home already shows the logo.
      expect(find.byType(NextLogo), findsNothing);
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

      final integer = tester.widget<Text>(find.text('10.000'));
      expect(integer.style!.color, NbBalanceCardColors.text);
    });

    // Found on the Home: in a list, the card merged into one node read as a
    // button ("next bank, Ocultar saldo, Saldo disponível…, R$ …"). Each
    // part must stay its own node for screen readers.
    testWidgets('keeps title, eye button and balance apart inside a list', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: NbTheme.dark(),
          home: Scaffold(
            body: ListView(
              children: [
                BalanceCard(
                  accountNumber: '100000-4',
                  balanceCents: 1000000,
                  hidden: false,
                  onToggleHidden: () {},
                ),
              ],
            ),
          ),
        ),
      );

      expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
      expect(find.bySemanticsLabel('Saldo disponível'), findsOneWidget);
      expect(
        tester.getSemantics(find.bySemanticsLabel('Ocultar saldo')),
        isSemantics(label: 'Ocultar saldo', isButton: true),
      );
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

  // v1.1.0 checkpoint (2026-10-14): the developer's green glass art fills
  // the card, under a dark tint that keeps it the same dark card.
  testWidgets('shows the glass art behind the balance', (tester) async {
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

    final art = tester.widget<Image>(
      find.descendant(
        of: find.byType(BalanceCard),
        matching: find.byType(Image),
      ),
    );
    expect(art.image, NbArt.glass);
  });

  // Brief, section 8: AA on every text. Every text sits on glass (the
  // account chip and the balance panel), over the tinted art; the check
  // takes white as the art's brightest pixel, wherever the crop falls.
  group('balance card contrast (AA)', () {
    final background = Color.alphaBlend(
      NbBalanceCardColors.glass,
      Color.alphaBlend(NbBalanceCardColors.tint, const Color(0xFFFFFFFF)),
    );
    for (final (name, color) in [
      ('balance', NbBalanceCardColors.text),
      ('label', NbBalanceCardColors.textMuted),
    ]) {
      test('$name on the glass over the brightest art', () {
        expect(contrast(color, background), greaterThanOrEqualTo(4.5));
      });
    }
  });
}
