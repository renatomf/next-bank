import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/help/presentation/help_screen.dart';

Future<void> pumpHelp(WidgetTester tester, {VoidCallback? onBack}) async {
  await tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: HelpScreen(onBack: onBack ?? () {}),
    ),
  );
  await tester.pumpAndSettle();
}

const _topics = [
  'Pix',
  'Pagar QR Code',
  'Receber',
  'Extrato',
  'Segurança',
  'Conta',
];

const _questions = [
  'Como fazer um Pix?',
  'Como pagar com QR Code?',
  'Como trocar o meu PIN?',
  'Como ver o meu extrato?',
  'Como desconectar um aparelho?',
];

// The help screen, layout only (v1.1.0 plan, task 4.5).
void main() {
  testWidgets('shows the topics of the app and the frequent questions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    await pumpHelp(tester);

    expect(find.text('Ajuda'), findsOneWidget);
    expect(find.text('Dúvidas por produto'), findsOneWidget);
    expect(find.text('Dúvidas mais acessadas'), findsOneWidget);
    for (final topic in _topics) {
      expect(find.widgetWithText(ActionTile, topic), findsOneWidget);
    }
    for (final question in _questions) {
      expect(find.text(question), findsOneWidget);
    }
  });

  testWidgets('lays the topics out in two rows of three', (tester) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    await pumpHelp(tester);

    final rows = tester
        .widgetList(find.byType(ActionTile))
        .map((tile) => tester.getTopLeft(find.byWidget(tile)).dy)
        .toList();
    expect(rows.toSet(), hasLength(2));
    expect(rows.where((dy) => dy == rows.first), hasLength(3));
  });

  // S21 checkpoint: "Acessar chat" ends where "Exibir todos" ends.
  testWidgets('aligns Acessar chat with Exibir todos on the right', (
    tester,
  ) async {
    await pumpHelp(tester);

    final chat = find.widgetWithText(TextButton, 'Acessar chat');
    final all = find.widgetWithText(TextButton, 'Exibir todos');
    expect(
      tester.getTopRight(chat).dx,
      moreOrLessEquals(tester.getTopRight(all).dx, epsilon: 1),
    );
  });

  testWidgets('goes back where the app says', (tester) async {
    var back = 0;
    await pumpHelp(tester, onBack: () => back++);

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(back, 1);
  });

  // Layout only: every tap says it is coming.
  for (final item in [
    'Acessar chat',
    'Exibir todos',
    ..._topics,
    ..._questions,
  ]) {
    testWidgets('says "$item" is coming', (tester) async {
      tester.view.physicalSize = const Size(1080, 3600);
      addTearDown(tester.view.reset);
      await pumpHelp(tester);

      await tester.tap(find.bySemanticsLabel(item).first);
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
    });
  }

  testWidgets('fits a small phone at 1.3x text', (tester) async {
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await pumpHelp(tester);

    expect(tester.takeException(), isNull);
  });
}
