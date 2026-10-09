import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

Widget host(Widget child) => MaterialApp(
  theme: NbTheme.dark(),
  home: Scaffold(
    body: Padding(padding: const EdgeInsets.all(20), child: child),
  ),
);

// The statement's components, each point checked against home-dark (F-14).
void main() {
  group('TransactionItem', () {
    Widget item({
      bool incoming = true,
      bool hidden = false,
      VoidCallback? onTap,
    }) => host(
      TransactionItem(
        title: incoming ? 'Pix recebido' : 'Pix enviado',
        caption: 'Mariana Costa · Hoje, 09:12',
        amountCents: 35000,
        incoming: incoming,
        hidden: hidden,
        onTap: onTap,
      ),
    );

    testWidgets('money in: a south-west arrow and a plus sign', (tester) async {
      await tester.pumpWidget(item());

      expect(find.text('Pix recebido'), findsOneWidget);
      expect(find.text('Mariana Costa · Hoje, 09:12'), findsOneWidget);
      expect(find.byIcon(Icons.south_west), findsOneWidget);
      expect(find.text(r'+ R$ 350,00'), findsOneWidget);
    });

    testWidgets('money out: a north-east arrow and a minus sign', (
      tester,
    ) async {
      await tester.pumpWidget(item(incoming: false));

      expect(find.byIcon(Icons.north_east), findsOneWidget);
      expect(find.text(r'− R$ 350,00'), findsOneWidget);
    });

    testWidgets('reads the direction and the amount aloud', (tester) async {
      await tester.pumpWidget(item(incoming: false));

      expect(
        find.bySemanticsLabel(
          r'Pix enviado, Mariana Costa · Hoje, 09:12, saída de R$ 350,00',
        ),
        findsOneWidget,
      );
    });

    // MOB-05: the amounts reveal the balance as much as the balance does.
    testWidgets('hides the amount, keeping the sign', (tester) async {
      await tester.pumpWidget(item(hidden: true));

      expect(find.textContaining('350'), findsNothing);
      expect(find.text(r'+ R$ ••••'), findsOneWidget);
      expect(
        find.bySemanticsLabel(
          'Pix recebido, Mariana Costa · Hoje, 09:12, valor oculto',
        ),
        findsOneWidget,
      );
    });

    // Brief, section 8: a large amount on a small phone at 1.3x text.
    testWidgets('fits a small phone at 1.3x text', (tester) async {
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

      await tester.pumpWidget(
        host(
          const SizedBox(
            width: 240,
            child: TransactionItem(
              title: 'Depósito inicial',
              caption: 'Hoje, 09:12',
              amountCents: 1000000,
              incoming: true,
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
    });

    // Found on a device: in the Home's card, "Depósito inicial" broke into
    // two lines beside "+ R$ 10.000,00".
    testWidgets('keeps the title on one line beside a large amount', (
      tester,
    ) async {
      Future<double> titleHeightAt(double width) async {
        await tester.pumpWidget(
          host(
            SizedBox(
              width: width,
              child: const TransactionItem(
                title: 'Depósito inicial',
                caption: 'Hoje, 09:12',
                amountCents: 1000000,
                incoming: true,
              ),
            ),
          ),
        );
        return tester.getSize(find.text('Depósito inicial')).height;
      }

      final oneLine = await titleHeightAt(700);

      expect(await titleHeightAt(288), lessThanOrEqualTo(oneLine));
      expect(tester.takeException(), isNull);
    });

    // Brief, section 7: sizes set by the developer on a device (week 6).
    testWidgets('a 36 circle, a 14 title and a 12 caption', (tester) async {
      await tester.pumpWidget(item());

      final circle = find.ancestor(
        of: find.byIcon(Icons.south_west),
        matching: find.byType(Container),
      );
      expect(tester.getSize(circle.first), const Size(36, 36));
      expect(
        tester.widget<Text>(find.text('Pix recebido')).style?.fontSize,
        14,
      );
      expect(
        tester
            .widget<Text>(find.text('Mariana Costa · Hoje, 09:12'))
            .style
            ?.fontSize,
        12,
      );
    });

    testWidgets('opens the detail on tap', (tester) async {
      var taps = 0;
      await tester.pumpWidget(item(onTap: () => taps++));

      await tester.tap(find.byType(TransactionItem));

      expect(taps, 1);
    });
  });

  testWidgets('EmptyState shows its icon, title and message', (tester) async {
    await tester.pumpWidget(
      host(
        const EmptyState(
          icon: Icons.receipt_long_outlined,
          title: 'Sem movimentações',
          message: 'Seus Pix aparecem aqui.',
        ),
      ),
    );

    expect(find.byIcon(Icons.receipt_long_outlined), findsOneWidget);
    expect(find.text('Sem movimentações'), findsOneWidget);
    expect(find.text('Seus Pix aparecem aqui.'), findsOneWidget);
  });

  testWidgets('ScreenHeader announces its title and names its button', (
    tester,
  ) async {
    var taps = 0;
    await tester.pumpWidget(
      host(
        ScreenHeader(
          title: 'Extrato',
          icon: Icons.arrow_back,
          iconLabel: 'Voltar',
          onPressed: () => taps++,
        ),
      ),
    );

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(taps, 1);
    expect(
      tester.getSemantics(find.text('Extrato')),
      isSemantics(label: 'Extrato', isHeader: true),
    );
  });
}
