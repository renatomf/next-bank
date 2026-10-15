import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/scan/scan_pix_screen.dart';

import '../support/fake_pix_repository.dart';
import '../support/fake_qr_scanner.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

/// Bruno's code as his "Receber" builds it, but carrying a forged name.
String brunosCode({int? amountCents, String? message}) => staticBrCode(
  key: brunoReceivingKey,
  receiverName: 'Loja Falsa',
  amountCents: amountCents,
  message: message,
);

/// Signed in, unlocked, on "Pagar com QR Code" opened from the Pix.
Future<void> openScan(
  WidgetTester tester,
  FakePixRepository pix,
  FakeQrScanner scanner,
) async {
  await pumpApp(
    tester,
    store: FakeTokenStore(tokens),
    pix: pix,
    scanner: scanner,
  );
  await unlockWithPin(tester);
  await tester.tap(find.bySemanticsLabel('Área Pix'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Pagar com QR Code'));
  await tester.pumpAndSettle();
}

/// The camera "reads" the code the fake holds.
Future<void> readWithCamera(WidgetTester tester) async {
  await tester.tap(find.text('Câmera de teste'));
  await tester.pumpAndSettle();
}

/// The clipboard holds [text], as after "Copiar código" on another phone.
void clipboardHolds(WidgetTester tester, String text) {
  tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
    SystemChannels.platform,
    (call) async => call.method == 'Clipboard.getData' ? {'text': text} : null,
  );
  addTearDown(
    () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      null,
    ),
  );
}

// Paying by QR Code (v1.1.0 plan, task 4): the code fills the Pix, with the
// server's name (PIX-11) and a fixed amount locked (PIX-13); the camera is
// only for this screen (MOB-10).
void main() {
  testWidgets("fills the Pix from the camera, with the server's name", (
    tester,
  ) async {
    final pix = FakePixRepository();
    final scanner = FakeQrScanner()
      ..code = brunosCode(amountCents: 2500, message: 'Pizza');
    await openScan(tester, pix, scanner);

    await readWithCamera(tester);

    expect(find.byType(ScanPixScreen), findsNothing);
    expect(pix.callsOf('lookup').single.key, (
      type: PixKeyType.random,
      value: brunoReceivingKey,
    ));
    // The holder of the key, never the name the code carries (PIX-11).
    expect(find.text('Mariana Costa'), findsOneWidget);
    expect(find.textContaining('LOJA FALSA'), findsNothing);
    expect(find.bySemanticsLabel(r'R$ 25,00'), findsOneWidget);
    // The pencil gives way to a lock: the amount is not typed over.
    expect(find.byIcon(Icons.lock_outline), findsOneWidget);
    expect(find.bySemanticsLabel('Digitar o valor'), findsNothing);
    expect(find.text('Pizza'), findsOneWidget);
    expect(find.text('Chave lida do QR Code'), findsOneWidget);
  });

  testWidgets('refuses a changed code and stays to read another', (
    tester,
  ) async {
    final pix = FakePixRepository();
    final scanner = FakeQrScanner()
      ..code = brunosCode(amountCents: 2500).replaceFirst('25.00', '95.00');
    await openScan(tester, pix, scanner);

    await readWithCamera(tester);

    expect(find.byType(ScanPixScreen), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Este QR Code não é um Pix válido.'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(ScanPixScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    expect(find.text('Este QR Code não é um Pix válido.'), findsOneWidget);
    expect(pix.callsOf('lookup'), isEmpty);
  });

  testWidgets('without the camera, pays the "Copia e Cola" pasted', (
    tester,
  ) async {
    final pix = FakePixRepository();
    final scanner = FakeQrScanner()..denied = true;
    clipboardHolds(tester, brunosCode());
    await openScan(tester, pix, scanner);
    await tester.pumpAndSettle();

    expect(find.textContaining('Sem acesso à câmera'), findsOneWidget);
    expect(find.text('Câmera de teste'), findsNothing);

    await tester.tap(find.bySemanticsLabel('Colar Copia e Cola'));
    await tester.pumpAndSettle();

    expect(find.byType(ScanPixScreen), findsNothing);
    expect(find.text('Mariana Costa'), findsOneWidget);
  });

  testWidgets('goes back to typing a CPF on "Usar chave CPF"', (tester) async {
    final scanner = FakeQrScanner()..code = brunosCode(amountCents: 2500);
    await openScan(tester, FakePixRepository(), scanner);
    await readWithCamera(tester);

    await tester.tap(find.text('Usar chave CPF'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(NbTextField, 'Chave CPF'), findsOneWidget);
    expect(find.bySemanticsLabel('Digitar o valor'), findsOneWidget);
  });
}
