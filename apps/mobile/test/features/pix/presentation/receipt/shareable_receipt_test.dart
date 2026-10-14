import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';
import 'package:next_bank/features/pix/presentation/receipt/shareable_receipt.dart';

import '../../../../support/app_fonts.dart';
import '../../../../support/fake_pix_repository.dart';

// v1.1.0 plan, task 1: the receipt shared as an image, in the next bank's
// light theme whatever the app's theme, with only what the screen masks
// (MOB-09) and the demo notice, without a watermark (DEMO-05; the
// developer's choice, 2026-10-14).
void main() {
  setUpAll(loadAppFonts);

  final completed = pixTransfer(
    status: PixStatus.completed,
    endToEndId: 'E00000000202610081733abcdefghijk',
  );

  Future<void> pumpReceipt(WidgetTester tester, {ThemeData? theme}) async {
    tester.view
      ..physicalSize = const Size(
        ShareableReceipt.width * 2,
        ShareableReceipt.width * 2 * 3.2,
      )
      ..devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: theme ?? NbTheme.dark(),
        home: Align(
          alignment: Alignment.topCenter,
          child: RepaintBoundary(
            child: ShareableReceipt(
              transfer: completed,
              payerName: 'Ana Souza',
              payerAccount: payerDetail(branch: '0001', number: '100000-4'),
            ),
          ),
        ),
      ),
    );
  }

  testWidgets(
    'looks like the approved receipt',
    tags: ['golden'],
    skip: !goldensRunHere,
    (tester) async {
      await pumpReceipt(tester);

      await expectLater(
        find.byType(ShareableReceipt),
        matchesGoldenFile('goldens/shareable_receipt.png'),
      );
    },
  );

  testWidgets(
    'is the same in the light theme: always the light receipt',
    tags: ['golden'],
    skip: !goldensRunHere,
    (tester) async {
      await pumpReceipt(tester, theme: NbTheme.light());

      await expectLater(
        find.byType(ShareableReceipt),
        matchesGoldenFile('goldens/shareable_receipt.png'),
      );
    },
  );

  testWidgets('shows who, how much, when and the transaction id', (
    tester,
  ) async {
    await pumpReceipt(tester);

    expect(find.text('Pix realizado'), findsOneWidget);
    expect(find.text('MC'), findsOneWidget);
    expect(find.text('Mariana Costa'), findsOneWidget);
    expect(find.text('Ana Souza'), findsOneWidget);
    expect(find.text(r'R$ 350,00'), findsOneWidget);
    expect(find.text('E00000000202610081733abcdefghijk'), findsOneWidget);
    expect(
      find.text(receiptLongDate(DateTime.utc(2026, 10, 8, 17, 33))),
      findsOneWidget,
    );
  });

  testWidgets('carries only what the screen masks', (tester) async {
    await pumpReceipt(tester);

    expect(find.textContaining('***.456.789-**'), findsOneWidget);
    expect(find.textContaining('•••• 0004'), findsOneWidget);
    expect(find.textContaining('100000'), findsNothing);
  });

  testWidgets('says it is a demo in a notice, with no watermark', (
    tester,
  ) async {
    await pumpReceipt(tester);

    expect(find.text(demoReceiptNotice), findsOneWidget);
    expect(find.text('DEMONSTRAÇÃO'), findsNothing);
  });

  test('refuses a Pix that is not completed', () {
    expect(
      () => ShareableReceipt(
        transfer: pixTransfer(status: PixStatus.processing),
        payerName: 'Ana Souza',
        payerAccount: 'next bank',
      ),
      throwsArgumentError,
    );
  });
}
