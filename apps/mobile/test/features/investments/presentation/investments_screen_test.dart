import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/investments/presentation/investments_screen.dart';
import 'package:next_bank/features/investments/presentation/recommended_shelf.dart';

import '../../../support/example_tag.dart';

Future<void> pumpInvestments(
  WidgetTester tester, {
  VoidCallback? onBack,
}) async {
  tester.view.physicalSize = const Size(1080, 4800);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: InvestmentsScreen(onBack: onBack ?? () {}),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> openTab(WidgetTester tester, String tab) async {
  await tester.tap(find.widgetWithText(Tab, tab));
  await tester.pumpAndSettle();
}

Finder comingSoon() => find.widgetWithText(NbToast, 'Em breve.');

// Investments, layout only (v1.1.0 plan, task 4.16): three tabs, made-up
// offers and generic product names.
void main() {
  testWidgets('opens on Rentabilidade', (tester) async {
    await pumpInvestments(tester);

    expect(find.text('Investimentos'), findsOneWidget);
    expect(find.text('Sem perfil de investidor'), findsOneWidget);
    expect(find.text('Tem investimentos em outro banco?'), findsOneWidget);
    expect(find.byType(RecommendedShelf), findsOneWidget);
    expect(find.text('102% do CDI'), findsOneWidget);
  });

  testWidgets('shows the products on Investir', (tester) async {
    await pumpInvestments(tester);

    await openTab(tester, 'Investir');

    expect(find.byType(RecommendedShelf), findsOneWidget);
    for (final product in [
      'Renda Fixa',
      'Tesouro Direto',
      'Fundos',
      'Bolsa de Valores',
      'Previdência',
      'Carteira Recomendada',
    ]) {
      expect(find.bySemanticsLabel(RegExp('^$product')), findsWidgets);
    }
    expect(find.text('Home Broker'), findsOneWidget);
    expect(find.text('Sem perfil de investidor'), findsNothing);
  });

  testWidgets('lists the rest on Mais', (tester) async {
    await pumpInvestments(tester);

    await openTab(tester, 'Mais');

    for (final row in [
      'Meus documentos',
      'Portabilidade',
      'Termos de investimento',
      'Fazer Pix via conta da corretora',
    ]) {
      expect(find.bySemanticsLabel(row), findsOneWidget, reason: row);
    }
    expect(
      find.text('Apenas três perguntas para definir seu perfil de investidor'),
      findsOneWidget,
    );
  });

  // Repository rules: no other bank's mark or product names.
  testWidgets('names no other bank', (tester) async {
    await pumpInvestments(tester);

    for (final tab in ['Rentabilidade', 'Investir', 'Mais']) {
      await openTab(tester, tab);
      expect(find.textContaining('C6'), findsNothing, reason: tab);
      expect(find.textContaining('CTVM'), findsNothing, reason: tab);
    }
  });

  // S21 checkpoint: a back arrow, as on the Pix screen.
  testWidgets('goes back where the app says', (tester) async {
    var back = 0;
    await pumpInvestments(tester, onBack: () => back++);

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(back, 1);
  });

  testWidgets('says Definir perfil is coming', (tester) async {
    await pumpInvestments(tester);

    await tester.tap(find.text('Definir perfil'));
    await tester.pumpAndSettle();

    expect(comingSoon(), findsOneWidget);
  });

  for (final tab in ['Rentabilidade', 'Investir', 'Mais']) {
    testWidgets('fits a small phone at 1.3x text on $tab', (tester) async {
      await pumpInvestments(tester);
      await openTab(tester, tab);
      tester.view
        ..physicalSize = const Size(320 * 3, 568 * 3)
        ..devicePixelRatio = 3;
      tester.platformDispatcher.textScaleFactorTestValue = 1.3;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
    });
  }

  // D7, revised (v1.1.0 plan, task 6): the made-up rates say they are
  // examples, on both tabs that show them.
  for (final tab in ['Rentabilidade', 'Investir']) {
    testWidgets('marks the recommended rates as examples on $tab', (
      tester,
    ) async {
      await pumpInvestments(tester);
      if (tab != 'Rentabilidade') await openTab(tester, tab);

      final heading = find.text('Investimentos recomendados');
      expect(exampleTagIn(blockOf<Row>(heading)), findsOneWidget);
    });
  }
}
