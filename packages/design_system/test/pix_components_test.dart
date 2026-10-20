import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
              icon: const Icon(Icons.pix),
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
