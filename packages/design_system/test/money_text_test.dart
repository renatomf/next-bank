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

      final text = tester.widget<RichText>(
        find.descendant(
          of: find.byType(MoneyText),
          matching: find.byType(RichText),
        ),
      );
      final spans = (text.text as TextSpan).children!.cast<TextSpan>();
      final [currency, integer, cents] = spans;
      expect(integer.style!.fontSize, greaterThan(currency.style!.fontSize!));
      expect(integer.style!.fontSize, greaterThan(cents.style!.fontSize!));
      expect(currency.style!.color, NbColors.dark.textMuted);
      expect(cents.style!.color, NbColors.dark.textMuted);
    });

    // MOB-05: someone beside the customer must not read the balance.
    testWidgets('hides every digit when hidden', (tester) async {
      await tester.pumpWidget(
        host(const MoneyText(cents: 1000000, hidden: true)),
      );

      expect(
        find.textContaining(RegExp(r'\d'), findRichText: true),
        findsNothing,
      );
      expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
      expect(find.bySemanticsLabel(RegExp(r'\d')), findsNothing);
    });
  });
}
