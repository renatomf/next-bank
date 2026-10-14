import 'dart:math';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/glass_art.dart';

Widget host(Widget child) => MaterialApp(
  theme: NbTheme.dark(),
  home: Scaffold(
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: child,
    ),
  ),
);

// The components of the Pix and the receipt, each point checked against the
// pix-dark, comprovante-dark and home-dark mockups (F-14).
void main() {
  group('AmountCard', () {
    Widget card({int? balance = 1268042, bool hidden = false, int cents = 0}) =>
        AmountCard(
          cents: cents,
          balanceCents: balance,
          balanceHidden: hidden,
          onEdit: () {},
        );

    testWidgets('asks the amount and shows it in reais', (tester) async {
      await tester.pumpWidget(host(card(cents: 35000)));

      expect(find.text('Quanto você quer enviar?'), findsOneWidget);
      expect(find.bySemanticsLabel(r'R$ 350,00'), findsOneWidget);
    });

    testWidgets('shows the available balance', (tester) async {
      await tester.pumpWidget(host(card()));

      expect(find.text('Saldo disponível'), findsOneWidget);
      expect(find.text(r'R$ 12.680,42'), findsOneWidget);
    });

    // MOB-05: the balance hidden on the Home stays hidden here.
    testWidgets('hides the balance when the customer hid it', (tester) async {
      await tester.pumpWidget(host(card(hidden: true)));

      expect(find.textContaining('12.680'), findsNothing);
      expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
    });

    testWidgets('shows a placeholder while the balance loads', (tester) async {
      await tester.pumpWidget(host(card(balance: null)));

      expect(find.byType(Skeleton), findsOneWidget);
    });

    testWidgets('the pencil asks to type the amount', (tester) async {
      var edits = 0;
      await tester.pumpWidget(
        host(
          AmountCard(
            cents: 0,
            balanceCents: 0,
            balanceHidden: false,
            onEdit: () => edits++,
          ),
        ),
      );

      await tester.tap(find.bySemanticsLabel('Digitar o valor'));

      expect(edits, 1);
    });

    // The balance card's mint glow underneath, so both cards look alike.
    testWidgets('glows mint underneath like the balance card', (tester) async {
      await tester.pumpWidget(host(card()));

      final glows = tester
          .widgetList<DecoratedBox>(
            find.descendant(
              of: find.byType(AmountCard),
              matching: find.byType(DecoratedBox),
            ),
          )
          .map((box) => box.decoration)
          .whereType<BoxDecoration>()
          .expand((decoration) => decoration.boxShadow ?? const <BoxShadow>[])
          .map((shadow) => shadow.color);
      expect(glows, contains(NbBalanceCardColors.shadow));
    });

    // v1.1.0 checkpoint (2026-10-14): the same mint glass art as the
    // balance card, its texts as they were.
    testWidgets('shows the mint glass art behind the amount', (tester) async {
      await tester.pumpWidget(host(card(cents: 35000)));

      expect(
        find.descendant(
          of: find.byType(AmountCard),
          matching: find.byType(GlassArt),
        ),
        findsOneWidget,
      );
    });

    // Brief, section 8: the texts sit right on the art, so the whole card
    // takes the deep tint; AA over the brightest pixel the art can give.
    group('contrast (AA)', () {
      final ground = Color.alphaBlend(
        NbBalanceCardColors.tintDeep,
        brightestArt(),
      );
      for (final (name, color) in [
        ('amount and labels', NbBalanceCardColors.text),
        (r'"R$" and cents', NbBalanceCardColors.textMuted),
      ]) {
        test('$name on the deep tint', () {
          final la = color.computeLuminance();
          final lb = ground.computeLuminance();
          final ratio = (max(la, lb) + 0.05) / (min(la, lb) + 0.05);
          expect(ratio, greaterThanOrEqualTo(4.5));
        });
      }
    });
  });

  group('ContactCard', () {
    testWidgets('shows the initial, the name and the document', (tester) async {
      await tester.pumpWidget(
        host(
          const ContactCard(
            name: 'Mariana Costa',
            detail: 'CPF ***.456.789-** · next bank',
          ),
        ),
      );

      expect(find.text('M'), findsOneWidget);
      expect(find.text('Mariana Costa'), findsOneWidget);
      expect(find.text('CPF ***.456.789-** · next bank'), findsOneWidget);
    });

    // Brief, section 8: selection is a check, not only a border color.
    testWidgets('marks the selected payee with a check', (tester) async {
      await tester.pumpWidget(
        host(const ContactCard(name: 'Mariana Costa', detail: 'CPF')),
      );

      expect(find.byIcon(Icons.check), findsOneWidget);
      expect(
        tester.getSemantics(find.byType(ContactCard)),
        isSemantics(label: 'Mariana Costa, CPF', isSelected: true),
      );
    });

    testWidgets('has no check when not selected', (tester) async {
      await tester.pumpWidget(
        host(
          const ContactCard(
            name: 'Mariana Costa',
            detail: 'CPF',
            selected: false,
          ),
        ),
      );

      expect(find.byIcon(Icons.check), findsNothing);
    });
  });

  testWidgets('SecureHint shows a padlock and its text', (tester) async {
    await tester.pumpWidget(
      host(const SecureHint(text: 'Você confirma com seu PIN antes de enviar')),
    );

    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    expect(
      find.text('Você confirma com seu PIN antes de enviar'),
      findsOneWidget,
    );
  });

  group('ActionTile', () {
    testWidgets('is 84 high and opens its destination', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(
          SizedBox(
            width: 80,
            child: ActionTile(
              icon: const PixMark(),
              label: 'Pix',
              onPressed: () => taps++,
            ),
          ),
        ),
      );

      await tester.tap(find.bySemanticsLabel('Pix'));

      expect(tester.getSize(find.byType(ActionTile)).height, ActionTile.height);
      expect(taps, 1);
    });
  });

  group('StatusBadge', () {
    // Brief, section 8: an icon and a word, never color alone.
    for (final (tone, icon) in [
      (StatusTone.success, Icons.check),
      (StatusTone.danger, Icons.close),
      (StatusTone.pending, Icons.schedule),
    ]) {
      testWidgets('${tone.name} has an icon and a word', (tester) async {
        await tester.pumpWidget(host(StatusBadge(tone: tone, label: 'Status')));

        expect(find.byIcon(icon), findsOneWidget);
        expect(find.text('Status'), findsOneWidget);
      });
    }
  });

  group('ReceiptCard', () {
    Widget receipt({String? description, String? transactionId}) => host(
      ReceiptCard(
        date: '8 out 2026 · 14:32',
        status: const StatusBadge(tone: StatusTone.success, label: 'Concluído'),
        from: (name: 'Renato M.', detail: 'next bank · Ag 0001 · CC •••• 0004'),
        to: (name: 'Mariana Costa', detail: 'CPF ***.456.789-** · next bank'),
        type: 'Pix · Chave CPF',
        description: description,
        transactionId: transactionId,
      ),
    );

    testWidgets('shows the date, the status, who paid and who received', (
      tester,
    ) async {
      await tester.pumpWidget(receipt());

      for (final text in [
        '8 out 2026 · 14:32',
        'Concluído',
        'DE',
        'Renato M.',
        'next bank · Ag 0001 · CC •••• 0004',
        'PARA',
        'Mariana Costa',
        'CPF ***.456.789-** · next bank',
        'TIPO',
        'Pix · Chave CPF',
      ]) {
        expect(find.text(text), findsOneWidget, reason: text);
      }
    });

    testWidgets('shows the description and the transaction id', (tester) async {
      await tester.pumpWidget(
        receipt(
          description: 'Aluguel de outubro',
          transactionId: 'E00000000202610081432a8F3k9QpZ2x',
        ),
      );

      expect(find.text('DESCRIÇÃO'), findsOneWidget);
      expect(find.text('Aluguel de outubro'), findsOneWidget);
      expect(find.text('ID DA TRANSAÇÃO'), findsOneWidget);
      final id = tester.widget<Text>(
        find.text('E00000000202610081432a8F3k9QpZ2x'),
      );
      expect(id.style?.fontFamily, 'monospace');
    });

    testWidgets('leaves out what the transfer does not have', (tester) async {
      await tester.pumpWidget(receipt());

      expect(find.text('DESCRIÇÃO'), findsNothing);
      expect(find.text('ID DA TRANSAÇÃO'), findsNothing);
    });
  });

  group('SecondaryButton', () {
    testWidgets('is 56 high and runs its action', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        host(
          SecondaryButton(label: 'Voltar ao início', onPressed: () => taps++),
        ),
      );

      await tester.tap(find.bySemanticsLabel('Voltar ao início'));

      expect(
        tester.getSize(find.byType(SecondaryButton)).height,
        NbSize.button,
      );
      expect(taps, 1);
    });
  });
}
