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

  // v1.1.0 checkpoint (2026-10-14): the Pix puts its balance eye on the
  // right, in the space that keeps the title centered.
  testWidgets('ScreenHeader takes an action on the right, title centered', (
    tester,
  ) async {
    await tester.pumpWidget(
      host(
        ScreenHeader(
          title: 'Pix',
          icon: Icons.arrow_back,
          iconLabel: 'Voltar',
          onPressed: () {},
          action: IconCircleButton(
            icon: Icons.visibility_off_outlined,
            label: 'Mostrar saldo',
            onPressed: () {},
          ),
        ),
      ),
    );

    final header = tester.getRect(find.byType(ScreenHeader));
    final action = tester.getRect(find.bySemanticsLabel('Mostrar saldo'));
    final title = tester.getRect(find.text('Pix'));
    expect(action.right, moreOrLessEquals(header.right, epsilon: 1));
    expect(title.center.dx, moreOrLessEquals(header.center.dx, epsilon: 1));
  });
}
