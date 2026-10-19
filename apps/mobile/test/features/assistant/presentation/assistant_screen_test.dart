import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/assistant/presentation/agent_sheet.dart';
import 'package:next_bank/features/assistant/presentation/assistant_screen.dart';

import '../../../support/device_stores.dart';
import '../../../support/fake_profile_repository.dart';
import '../../../support/fake_token_store.dart';

Future<void> pumpAssistant(WidgetTester tester, {VoidCallback? onClose}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...deviceStoreOverrides(),
        tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
        profileRepositoryProvider.overrideWithValue(FakeProfileRepository()),
      ],
      child: MaterialApp(
        theme: NbTheme.dark(),
        home: AssistantScreen(onClose: onClose ?? () {}),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> tap(WidgetTester tester, Finder finder) async {
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

Finder comingSoon() => find.widgetWithText(NbToast, 'Em breve.');

const _agents = [
  'Pedir ajuda',
  'Fazer transações',
  'Analisar extrato de conta',
];

// The assistant, layout only (v1.1.0 plan, task 4.10).
void main() {
  testWidgets('greets the customer by first name, with the agents', (
    tester,
  ) async {
    await pumpAssistant(tester);

    expect(find.text('Olá, Ana'), findsOneWidget);
    expect(find.text('Como podemos começar?'), findsOneWidget);
    for (final agent in _agents) {
      expect(find.bySemanticsLabel(agent), findsOneWidget, reason: agent);
    }
    expect(find.text('Respostas geradas por IA'), findsOneWidget);
  });

  for (final label in [
    ..._agents,
    'Nova conversa',
    'Criar lembrete',
    'Câmera',
    'Microfone',
  ]) {
    testWidgets('says "$label" is coming', (tester) async {
      await pumpAssistant(tester);

      await tap(tester, find.bySemanticsLabel(label).first);

      expect(comingSoon(), findsOneWidget);
    });
  }

  testWidgets('takes typing in the field, sending nothing', (tester) async {
    await pumpAssistant(tester);

    await tester.enterText(find.byType(TextField), 'qual é o meu saldo?');
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();

    expect(find.text('qual é o meu saldo?'), findsOneWidget);
    expect(comingSoon(), findsOneWidget);
  });

  testWidgets('opens the attach menu on the plus, each item coming', (
    tester,
  ) async {
    await pumpAssistant(tester);

    await tap(tester, find.bySemanticsLabel('Anexar'));
    for (final item in ['Galeria', 'Arquivos', 'Buscar contato']) {
      expect(find.text(item), findsOneWidget, reason: item);
    }
    await tap(tester, find.text('Galeria'));

    expect(comingSoon(), findsOneWidget);
  });

  testWidgets('opens the agent sheet, which its X closes', (tester) async {
    await pumpAssistant(tester);

    await tap(tester, find.bySemanticsLabel('Escolher agente'));
    final sheet = find.byType(AgentSheet);
    expect(sheet, findsOneWidget);
    expect(
      find.descendant(of: sheet, matching: find.text('Qual agente quer usar?')),
      findsOneWidget,
    );
    expect(
      find.descendant(
        of: sheet,
        matching: find.text(
          'Agente para responder dúvidas de produtos e resolver problemas.',
        ),
      ),
      findsOneWidget,
    );

    // The sheet's own X: the screen has one too.
    await tap(
      tester,
      find.descendant(of: sheet, matching: find.bySemanticsLabel('Fechar')),
    );

    expect(find.byType(AgentSheet), findsNothing);
  });

  testWidgets('closes the sheet on an agent, saying it is coming', (
    tester,
  ) async {
    await pumpAssistant(tester);
    await tap(tester, find.bySemanticsLabel('Escolher agente'));

    await tap(
      tester,
      find.descendant(
        of: find.byType(AgentSheet),
        matching: find.bySemanticsLabel(RegExp('^Fazer transações')),
      ),
    );

    expect(find.byType(AgentSheet), findsNothing);
    expect(comingSoon(), findsOneWidget);
  });

  testWidgets('closes where the app says', (tester) async {
    var closed = 0;
    await pumpAssistant(tester, onClose: () => closed++);

    await tap(tester, find.bySemanticsLabel('Fechar'));

    expect(closed, 1);
  });

  for (final withSheet in [false, true]) {
    testWidgets(
      'fits a small phone at 1.3x text${withSheet ? ', the sheet open' : ''}',
      (tester) async {
        await pumpAssistant(tester);
        tester.view
          ..physicalSize = const Size(320 * 3, 568 * 3)
          ..devicePixelRatio = 3;
        tester.platformDispatcher.textScaleFactorTestValue = 1.3;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await tester.pumpAndSettle();
        if (withSheet) {
          await tap(tester, find.bySemanticsLabel('Escolher agente'));
        }

        expect(tester.takeException(), isNull);
      },
    );
  }
}
