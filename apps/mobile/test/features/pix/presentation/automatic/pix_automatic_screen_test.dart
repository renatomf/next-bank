import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/pix/presentation/automatic/automatic_payment_sheet.dart';
import 'package:next_bank/features/pix/presentation/automatic/automatic_payment_tile.dart';
import 'package:next_bank/features/pix/presentation/automatic/pix_automatic_screen.dart';

import '../../../../support/device_stores.dart';
import '../../../../support/fake_profile_repository.dart';
import '../../../../support/fake_token_store.dart';

Future<void> pumpAutomatic(WidgetTester tester, {VoidCallback? onBack}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...deviceStoreOverrides(),
        tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
        profileRepositoryProvider.overrideWithValue(FakeProfileRepository()),
      ],
      child: MaterialApp(
        theme: NbTheme.dark(),
        home: PixAutomaticScreen(onBack: onBack ?? () {}),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> openFirstAccount(WidgetTester tester) async {
  await tester.tap(find.byType(AutomaticPaymentTile).first);
  await tester.pumpAndSettle();
}

// Pix Automático, layout only (v1.1.0 plan, task 4.7): fictitious accounts
// and their details in a sheet.
void main() {
  testWidgets('lists the registered accounts', (tester) async {
    await pumpAutomatic(tester);

    expect(find.text('Gerencie suas contas no Pix Automático'), findsOneWidget);
    expect(find.text('Cadastradas'), findsOneWidget);
    expect(find.byType(AutomaticPaymentTile), findsNWidgets(3));
    expect(find.textContaining('Streaming Exemplo Ltda.'), findsOneWidget);
  });

  for (final action in ['Cadastrar nova conta', 'Ajuda']) {
    testWidgets('says "$action" is coming', (tester) async {
      await pumpAutomatic(tester);

      await tester.tap(find.bySemanticsLabel(action).first);
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
    });
  }

  // READ-02: the payer's CPF only as the server masks it.
  testWidgets('opens an account in a sheet, the payer masked', (tester) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    await pumpAutomatic(tester);

    await openFirstAccount(tester);

    final sheet = find.byType(AutomaticPaymentSheet);
    expect(sheet, findsOneWidget);
    for (final text in [
      'Streaming Exemplo Ltda.',
      'CNPJ 00.000.000/0000-00',
      'Valor',
      'Frequência',
      'Mensal',
      'Pagador',
      'Ana Souza',
      '***.444.777-**',
      'Autorizado',
    ]) {
      expect(
        find.descendant(of: sheet, matching: find.text(text)),
        findsOneWidget,
        reason: text,
      );
    }
  });

  for (final action in ['Definir', 'Contas de casa', 'Abrir']) {
    testWidgets('says "$action" in the sheet is coming', (tester) async {
      tester.view.physicalSize = const Size(1080, 3600);
      addTearDown(tester.view.reset);
      await pumpAutomatic(tester);
      await openFirstAccount(tester);

      await tester.tap(find.text(action));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
    });
  }

  testWidgets('closes the sheet on its X', (tester) async {
    await pumpAutomatic(tester);
    await openFirstAccount(tester);

    await tester.tap(find.bySemanticsLabel('Fechar'));
    await tester.pumpAndSettle();

    expect(find.byType(AutomaticPaymentSheet), findsNothing);
  });

  testWidgets('goes back where the app says', (tester) async {
    var back = 0;
    await pumpAutomatic(tester, onBack: () => back++);

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(back, 1);
  });

  for (final withSheet in [false, true]) {
    testWidgets(
      'fits a small phone at 1.3x text${withSheet ? ', the sheet open' : ''}',
      (tester) async {
        tester.view
          ..physicalSize = const Size(320 * 3, 568 * 3)
          ..devicePixelRatio = 3;
        tester.platformDispatcher.textScaleFactorTestValue = 1.3;
        addTearDown(tester.view.reset);
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

        await pumpAutomatic(tester);
        if (withSheet) await openFirstAccount(tester);

        expect(tester.takeException(), isNull);
      },
    );
  }
}
