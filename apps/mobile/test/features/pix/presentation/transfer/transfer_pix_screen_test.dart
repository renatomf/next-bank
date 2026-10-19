import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/presentation/transfer/bank_account_form.dart';
import 'package:next_bank/features/pix/presentation/transfer/bank_list.dart';
import 'package:next_bank/features/pix/presentation/transfer/transfer_pix_screen.dart';

Future<void> pumpTransfer(
  WidgetTester tester, {
  VoidCallback? onBack,
  VoidCallback? onScan,
}) async {
  tester.view.physicalSize = const Size(1080, 3600);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    MaterialApp(
      theme: NbTheme.dark(),
      home: TransferPixScreen(onBack: onBack ?? () {}, onScan: onScan ?? () {}),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> openBanks(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Agência e conta'));
  await tester.pumpAndSettle();
}

Finder field(String hint) => find.widgetWithText(TextField, hint);

// Transferir, layout only (v1.1.0 plan, task 4.9): the Chave Pix tab with
// made-up contacts, and the Agência e conta tab with the main banks.
void main() {
  group('the Chave Pix tab', () {
    testWidgets('opens first, with the key field and the contacts', (
      tester,
    ) async {
      await pumpTransfer(tester);

      expect(
        find.text(
          'Insira uma chave Pix, um contato da sua lista ou leia um QR Code',
        ),
        findsOneWidget,
      );
      expect(find.text('Contatos Pix'), findsOneWidget);
      expect(find.text('Mariana Costa'), findsOneWidget);
      expect(find.text('Buscar banco'), findsNothing);
    });

    testWidgets('filters the contacts by name', (tester) async {
      await pumpTransfer(tester);

      await tester.enterText(field('Buscar contato'), 'mariana');
      await tester.pumpAndSettle();

      expect(find.text('Mariana Costa'), findsOneWidget);
      expect(find.text('Carlos Pereira'), findsNothing);
    });

    for (final label in [
      'Limites de uso',
      'Agenda do celular',
      'Faça vários Pix de uma vez',
      'Favoritar Mariana Costa',
      'Mais opções de Mariana Costa',
    ]) {
      testWidgets('says "$label" is coming', (tester) async {
        await pumpTransfer(tester);

        await tester.tap(find.bySemanticsLabel(label).first);
        await tester.pumpAndSettle();

        expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
      });
    }
  });

  group('the Agência e conta tab', () {
    testWidgets('lists ten banks with their codes and initials, then more', (
      tester,
    ) async {
      await pumpTransfer(tester);
      await openBanks(tester);

      expect(find.byType(BankTile), findsNWidgets(10));
      final first = find.byType(BankTile).first;
      for (final text in ['Banco do Brasil', '001', 'BB']) {
        expect(
          find.descendant(of: first, matching: find.text(text)),
          findsOneWidget,
          reason: text,
        );
      }

      final more = find.widgetWithText(TextButton, 'Carregar mais');
      await tester.ensureVisible(more);
      await tester.pumpAndSettle();
      await tester.tap(more);
      await tester.pumpAndSettle();

      expect(find.byType(BankTile), findsNWidgets(20));
    });

    for (final (query, bank) in [('nubank', 'Nubank'), ('104', 'Caixa')]) {
      testWidgets('searches the banks for "$query"', (tester) async {
        await pumpTransfer(tester);
        await openBanks(tester);

        await tester.enterText(field('Buscar banco'), query);
        await tester.pumpAndSettle();

        expect(find.byType(BankTile), findsOneWidget);
        expect(find.textContaining(bank), findsOneWidget);
        expect(find.widgetWithText(TextButton, 'Carregar mais'), findsNothing);
      });
    }

    testWidgets('opens the account form for a bank, and Alterar goes back', (
      tester,
    ) async {
      await pumpTransfer(tester);
      await openBanks(tester);

      await tester.tap(find.byType(BankTile).first);
      await tester.pumpAndSettle();

      expect(find.byType(BankAccountForm), findsOneWidget);
      expect(find.text('Banco do Brasil'), findsOneWidget);
      expect(field('Agência'), findsOneWidget);
      expect(field('Conta e dígito'), findsOneWidget);
      expect(find.text('Para dígito X, utilize 0'), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Alterar'));
      await tester.pumpAndSettle();

      expect(find.byType(BankTile), findsWidgets);
    });

    testWidgets('says Continuar is coming', (tester) async {
      await pumpTransfer(tester);
      await openBanks(tester);
      await tester.tap(find.byType(BankTile).first);
      await tester.pumpAndSettle();

      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
    });
  });

  // S21 checkpoint: the camera opens the QR Code reading.
  testWidgets('opens the QR Code reading on the camera', (tester) async {
    var scans = 0;
    await pumpTransfer(tester, onScan: () => scans++);

    await tester.tap(find.bySemanticsLabel('Ler QR Code'));
    await tester.pumpAndSettle();

    expect(scans, 1);
    expect(find.widgetWithText(NbToast, 'Em breve.'), findsNothing);
  });

  // S21 checkpoint: on a small phone at 1.3x text, the two pills share one
  // row and "Limites de uso" stays on one line.
  testWidgets('keeps the pills on one row and Limites de uso on one line', (
    tester,
  ) async {
    await pumpTransfer(tester);
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpAndSettle();

    final pills = find.byType(FilterPill);
    expect(tester.getTopLeft(pills.first).dy, tester.getTopLeft(pills.last).dy);
    const label = 'Limites de uso';
    final paragraph = tester.renderObject<RenderParagraph>(find.text(label));
    final boxes = paragraph.getBoxesForSelection(
      const TextSelection(baseOffset: 0, extentOffset: label.length),
    );
    expect(boxes.map((box) => box.top).toSet(), hasLength(1));
    expect(tester.takeException(), isNull);
  });

  // S21 checkpoint: "Fazer Pix ou TED" on the start, "Limites de uso" on
  // the end, apart, as the card below them.
  testWidgets('puts Limites de uso on the right edge', (tester) async {
    await pumpTransfer(tester);
    // A wide screen: the button needs less than half the row.
    tester.view.devicePixelRatio = 1.5;
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpAndSettle();

    final screen = tester.getSize(find.byType(TransferPixScreen)).width;
    final limits = find.widgetWithText(FilledButton, 'Limites de uso');
    expect(
      tester.getTopRight(limits).dx,
      moreOrLessEquals(screen - NbSpace.screen, epsilon: 1),
    );
  });

  testWidgets('goes back where the app says', (tester) async {
    var back = 0;
    await pumpTransfer(tester, onBack: () => back++);

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(back, 1);
  });

  for (final banks in [false, true]) {
    testWidgets(
      'fits a small phone at 1.3x text on the ${banks ? 'banks' : 'key'} tab',
      (tester) async {
        await pumpTransfer(tester);
        if (banks) await openBanks(tester);
        tester.view
          ..physicalSize = const Size(320 * 3, 568 * 3)
          ..devicePixelRatio = 3;
        tester.platformDispatcher.textScaleFactorTestValue = 1.3;
        addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
        await tester.pumpAndSettle();

        expect(tester.takeException(), isNull);
      },
    );
  }
}
