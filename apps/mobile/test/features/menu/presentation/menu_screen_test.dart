import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/menu/presentation/menu_card.dart';
import 'package:next_bank/features/menu/presentation/menu_screen.dart';

Future<void> pumpMenu(WidgetTester tester, {VoidCallback? onBack}) async {
  tester.view.physicalSize = const Size(1080, 12000);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: MenuScreen(onBack: onBack ?? () {}),
    ),
  );
  await tester.pumpAndSettle();
}

const _sections = [
  'Para você',
  'Acessos rápidos',
  'Cartões',
  'Linhas de crédito',
  'Pix e Transferências',
  'Pagamentos',
  'Investimentos',
  'Seguros',
  'Veículos',
  'Recargas e Gift Card',
  'Viagens',
];

// The full menu, layout only (v1.1.0 plan, task 4.13).
void main() {
  testWidgets('shows the search and the sections in order', (tester) async {
    await pumpMenu(tester);

    expect(find.widgetWithText(TextField, 'Buscar no app'), findsOneWidget);
    final tops = [
      for (final section in _sections) tester.getTopLeft(find.text(section)).dy,
    ];
    expect(tops, orderedEquals([...tops]..sort()));
  });

  testWidgets('lays the cards out three to a row', (tester) async {
    await pumpMenu(tester);

    final cards = find.byType(MenuCard);
    final firstRow = [
      for (var i = 0; i < 3; i++) tester.getTopLeft(cards.at(i)).dy,
    ];
    expect(firstRow.toSet(), hasLength(1));
    expect(tester.getTopLeft(cards.at(3)).dy, greaterThan(firstRow.first));
    expect(
      find.descendant(
        of: find.widgetWithText(MenuCard, 'Limites de crédito').first,
        matching: find.byType(Icon),
      ),
      findsOneWidget,
    );
  });

  testWidgets('marks Consignado do Trabalhador as new', (tester) async {
    await pumpMenu(tester);

    expect(
      find.descendant(
        of: find.widgetWithText(MenuCard, 'Consignado do Trabalhador'),
        matching: find.text('Novo'),
      ),
      findsOneWidget,
    );
  });

  // Repository rules: no third party's marks or another bank's products.
  testWidgets('names no third-party mark', (tester) async {
    await pumpMenu(tester);

    for (final mark in ['Samsung', 'C6', 'JP Morgan']) {
      expect(find.textContaining(mark), findsNothing, reason: mark);
    }
    expect(find.widgetWithText(MenuCard, 'Carteira digital'), findsWidgets);
  });

  // S21 checkpoint: a back arrow, as on the Pix screen.
  testWidgets('goes back where the app says', (tester) async {
    var back = 0;
    await pumpMenu(tester, onBack: () => back++);

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(back, 1);
  });

  testWidgets('says a card is coming', (tester) async {
    await pumpMenu(tester);

    await tester.tap(find.byType(MenuCard).first);
    await tester.pumpAndSettle();

    expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
  });

  testWidgets('fits a small phone at 1.3x text', (tester) async {
    await pumpMenu(tester);
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
