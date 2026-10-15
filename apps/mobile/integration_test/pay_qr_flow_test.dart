import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:next_bank/core/scan/qr_scanner.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/scan/scan_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/main.dart' as app;

import 'support/e2e.dart';

// Paying by QR Code, end to end (v1.1.0 plan, task 4): Bruno's random key
// comes from the real API, as his "Receber" screen gets it, and becomes the
// "Copia e Cola" of R$ 1,00; Ana pastes it, sees Bruno's name as the server
// returns it (PIX-11), confirms with the PIN and gets the receipt. Run as
// critical_flow_test.dart says.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('Bruno receives by QR Code; Ana pastes it and pays', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    final key = await receivingKeyOf(brunoEmail, brunoPassword);
    // The name a forger would write: the screen must never show it.
    final code = staticBrCode(
      key: key,
      receiverName: 'Loja Falsa',
      amountCents: 100,
      message: 'Teste E2E',
    );
    await Clipboard.setData(ClipboardData(text: code));

    // The camera opens with the reading screen, and its permission dialog
    // would take the focus the clipboard needs: the E2E pastes, so it runs
    // with a stand-in camera (a real one reads nothing in CI anyway).
    await app.main(
      overrides: [
        qrScannerProvider.overrideWithValue(
          ({required onCode, required onCameraDenied}) => const SizedBox(),
        ),
      ],
    );
    await signIn(tester, email: anaEmail, password: anaPassword);

    await tester.tap(find.text('Pagar'));
    await waitFor(tester, find.byType(ScanPixScreen));
    await scrollAndTap(
      tester,
      ScanPixScreen,
      find.bySemanticsLabel('Colar Copia e Cola'),
    );

    // Back on the Pix, filled: the server's name, the fixed amount.
    await waitFor(tester, find.text('Bruno Demo'));
    expect(find.textContaining('LOJA FALSA'), findsNothing);
    expect(find.bySemanticsLabel(r'R$ 1,00'), findsWidgets);
    expect(find.text('Chave lida do QR Code'), findsOneWidget);
    await scrollAndTap(tester, SendPixScreen, find.text('Revisar Pix'));

    await waitFor(tester, find.byType(ReviewPixScreen));
    await tester.scrollUntilVisible(
      find.byType(PinField),
      200,
      scrollable: find
          .descendant(
            of: find.byType(ReviewPixScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.enterText(find.byType(PinField), anaPin);
    await waitFor(tester, find.text('Concluído'));
    expect(find.text('Comprovante'), findsOneWidget);
    expect(find.text('Bruno Demo'), findsWidgets);

    semantics.dispose();
  });
}
