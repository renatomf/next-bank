import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/pix/presentation/keys/pix_keys_screen.dart';

import '../../../../support/device_stores.dart';
import '../../../../support/fake_profile_repository.dart';
import '../../../../support/fake_token_store.dart';

Future<void> pumpKeys(WidgetTester tester, {VoidCallback? onBack}) async {
  tester.view.physicalSize = const Size(1080, 3600);
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
        home: PixKeysScreen(onBack: onBack ?? () {}),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

// Minhas chaves, layout only (v1.1.0 plan, task 4.8): made-up keys and the
// suggestions to register.
void main() {
  testWidgets('shows the registered keys, made up', (tester) async {
    await pumpKeys(tester);

    expect(find.text('Minhas chaves cadastradas · 2 de 5'), findsOneWidget);
    expect(find.text('11111111-2222-4333-8444-555555555555'), findsOneWidget);
    expect(find.text('+55 (11) 90000-0000'), findsOneWidget);
  });

  // READ-02: the suggested CPF only as the server masks it.
  testWidgets('suggests the CPF, masked and recommended, and others', (
    tester,
  ) async {
    await pumpKeys(tester);

    expect(find.text('Cadastre também:'), findsOneWidget);
    expect(find.text('***.444.777-**'), findsOneWidget);
    expect(find.text('Recomendada'), findsOneWidget);
    expect(find.text('cliente@exemplo.com'), findsOneWidget);
    expect(find.text('Chave Pix gerada automaticamente'), findsOneWidget);
    expect(find.text('Cadastrar com outros dados'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Cadastrar'), findsNWidgets(4));
  });

  for (final (name, finder) in [
    ('Selecionar', find.widgetWithText(TextButton, 'Selecionar')),
    ('Copiar', find.bySemanticsLabel(RegExp('^Copiar'))),
    ('Compartilhar', find.bySemanticsLabel(RegExp('^Compartilhar'))),
    ('Cadastrar', find.widgetWithText(TextButton, 'Cadastrar')),
  ]) {
    testWidgets('says "$name" is coming', (tester) async {
      await pumpKeys(tester);

      await tester.tap(finder.first);
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
    });
  }

  testWidgets('takes typing in the other-data field', (tester) async {
    await pumpKeys(tester);

    await tester.enterText(find.byType(TextField), 'outro@exemplo.com');

    expect(find.text('outro@exemplo.com'), findsOneWidget);
  });

  testWidgets('goes back where the app says', (tester) async {
    var back = 0;
    await pumpKeys(tester, onBack: () => back++);

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(back, 1);
  });

  testWidgets('fits a small phone at 1.3x text', (tester) async {
    await pumpKeys(tester);
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
  });
}
