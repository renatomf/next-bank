import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child) => MaterialApp(
  theme: NbTheme.dark(),
  home: Scaffold(body: Center(child: child)),
);

// Money on screen (brief, section 3; ADR 0006): "R$", the integer and the
// cents in different styles, formatted only here, from integer cents.
void main() {
  group('formatReais', () {
    for (final (cents, integer, decimals) in [
      (1000000, '10.000', ',00'),
      (5, '0', ',05'),
      (99, '0', ',99'),
      (100, '1', ',00'),
      (123456789, '1.234.567', ',89'),
    ]) {
      test('$cents cents read R\$ $integer$decimals', () {
        final parts = formatReais(cents);

        expect(parts.integer, integer);
        expect(parts.cents, decimals);
        expect(parts.full, 'R\$ $integer$decimals');
      });
    }

    test('refuses a negative amount: a balance is never negative', () {
      expect(() => formatReais(-1), throwsArgumentError);
    });
  });

  group('MoneyText', () {
    testWidgets('shows the currency, the integer and the cents apart', (
      tester,
    ) async {
      await tester.pumpWidget(host(const MoneyText(cents: 1000000)));

      expect(find.textContaining('10.000', findRichText: true), findsOneWidget);
      expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
    });

    testWidgets('shows the currency and cents smaller and muted', (
      tester,
    ) async {
      await tester.pumpWidget(host(const MoneyText(cents: 1000000)));

      TextStyle styleOf(String text) =>
          tester.widget<Text>(find.text(text)).style!;
      final currency = styleOf(r'R$');
      final integer = styleOf('10.000');
      final cents = styleOf(',00');
      // Mockup: 18, 34 and 20 px.
      expect(
        [currency.fontSize, integer.fontSize, cents.fontSize],
        [18, 34, 20],
      );
      expect(currency.color, NbColors.dark.textMuted);
      expect(cents.color, NbColors.dark.textMuted);
      expect(integer.color, NbColors.dark.text);
    });

    testWidgets('sets the three parts 6 px apart on one baseline (mockup)', (
      tester,
    ) async {
      await tester.pumpWidget(host(const MoneyText(cents: 1000000)));

      final currency = tester.getRect(find.text(r'R$'));
      final integer = tester.getRect(find.text('10.000'));
      final cents = tester.getRect(find.text(',00'));
      expect(integer.left - currency.right, 6);
      expect(cents.left - integer.right, 6);
    });

    // Found on the emulator: Sora has no "•" glyph, so the hidden balance
    // showed empty squares. Widget tests draw a test font and cannot see it,
    // so the mask must come from a family that has the glyph: Manrope, which
    // already draws "•••• 0004" on the card.
    testWidgets('draws the hidden mask in a font that has the bullet', (
      tester,
    ) async {
      await tester.pumpWidget(
        host(
          const MoneyText(
            cents: 1000000,
            hidden: true,
            hiddenLabel: 'Saldo oculto',
          ),
        ),
      );

      final mask = tester.widget<Text>(find.text('••••••'));
      expect(mask.style!.fontFamily, 'packages/design_system/${NbType.body}');
    });

    // MOB-05: someone beside the customer must not read the balance.
    testWidgets('hides every digit when hidden', (tester) async {
      await tester.pumpWidget(
        host(
          const MoneyText(
            cents: 1000000,
            hidden: true,
            hiddenLabel: 'Saldo oculto',
          ),
        ),
      );

      expect(
        find.textContaining(RegExp(r'\d'), findRichText: true),
        findsNothing,
      );
      expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'\d')), findsNothing);
    });

    // Found on the phone: tapping the eye made "R$" jump, because the line
    // changed height when the digits became bullets.
    testWidgets(r'keeps "R$" still when the amount is hidden or shown', (
      tester,
    ) async {
      await tester.pumpWidget(host(const MoneyText(cents: 1000000)));
      final shown = tester.getRect(find.text(r'R$'));
      final shownSize = tester.getSize(find.byType(MoneyText));

      await tester.pumpWidget(
        host(
          const MoneyText(
            cents: 1000000,
            hidden: true,
            hiddenLabel: 'Saldo oculto',
          ),
        ),
      );

      expect(tester.getRect(find.text(r'R$')).top, shown.top);
      expect(tester.getSize(find.byType(MoneyText)).height, shownSize.height);
    });
  });
}
