import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/presentation/receive/receive_pix_screen.dart';

import '../support/fake_image_sharer.dart';
import '../support/fake_pix_repository.dart';
import '../support/fake_profile_repository.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

/// A field of the design system, found by the label above it.
Finder labeled(String label) => find.descendant(
  of: find.widgetWithText(NbTextField, label),
  matching: find.byType(TextField),
);

/// Bruno's code, as the screen should build it.
String brunosCode({int? amountCents, String? message}) => staticBrCode(
  key: brunoReceivingKey,
  receiverName: 'Bruno Lima',
  amountCents: amountCents,
  message: message,
);

/// Signed in as Bruno, unlocked, on "Receber" opened from the Pix.
Future<void> openReceive(
  WidgetTester tester,
  FakePixRepository pix, {
  FakeTextSharer? textSharer,
}) async {
  await pumpApp(
    tester,
    store: FakeTokenStore(tokens),
    profile: FakeProfileRepository(name: 'Bruno Lima'),
    pix: pix,
    textSharer: textSharer,
  );
  await unlockWithPin(tester);
  await tester.tap(find.bySemanticsLabel('Área Pix'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Receber'));
  await tester.pumpAndSettle();
}

/// Scrolls "Receber" until [finder] is built and on screen.
Future<void> scrollTo(WidgetTester tester, Finder finder) =>
    tester.scrollUntilVisible(
      finder,
      200,
      scrollable: find
          .descendant(
            of: find.byType(ReceivePixScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );

Future<void> typeInto(WidgetTester tester, Finder field, String text) async {
  await scrollTo(tester, field);
  await tester.enterText(field, text);
  await tester.pumpAndSettle();
}

Future<void> tapButton(WidgetTester tester, String label) async {
  await scrollTo(tester, find.bySemanticsLabel(label));
  await tester.tap(find.bySemanticsLabel(label));
  await tester.pump();
}

/// The text the code carries, read from the QR Code on screen.
String codeOnScreen(WidgetTester tester) =>
    tester.widget<QrCodeView>(find.byType(QrCodeView)).data;

// "Receber" (v1.1.0 plan, task 3): the QR Code of the customer's random key,
// never the CPF (PIX-12), with the amount and message optional.
void main() {
  testWidgets("shows the QR Code of the customer's random key", (tester) async {
    final pix = FakePixRepository();
    await openReceive(tester, pix);

    expect(find.byType(QrCodeView), findsOneWidget);
    expect(find.bySemanticsLabel('QR Code para receber o Pix'), findsOneWidget);
    expect(find.text('1111****-****-****-****-********5555'), findsOneWidget);
    expect(codeOnScreen(tester), brunosCode());
    expect(pix.callsOf('receivingKey'), hasLength(1));
  });

  // Since the S21 checkpoint, from the Pix box's "Gerar QR Code".
  testWidgets("opens from the Home's Pix box too", (tester) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    await pumpApp(
      tester,
      store: FakeTokenStore(tokens),
      profile: FakeProfileRepository(name: 'Bruno Lima'),
      pix: FakePixRepository(),
    );
    await unlockWithPin(tester);

    await tester.tap(find.bySemanticsLabel('Gerar QR Code'));
    await tester.pumpAndSettle();

    expect(find.byType(ReceivePixScreen), findsOneWidget);
    expect(codeOnScreen(tester), brunosCode());
  });

  testWidgets('puts the amount and the message in the code', (tester) async {
    await openReceive(tester, FakePixRepository());

    await typeInto(tester, labeled('Valor (opcional)'), '2500');
    await typeInto(tester, labeled('Mensagem (opcional)'), 'Pizza de sábado');

    expect(
      codeOnScreen(tester),
      brunosCode(amountCents: 2500, message: 'Pizza de sabado'),
    );
  });

  testWidgets('copies the "Copia e Cola" and says so', (tester) async {
    final copied = <String>[];
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      SystemChannels.platform,
      (call) async {
        if (call.method == 'Clipboard.setData') {
          copied.add(
            (call.arguments as Map<Object?, Object?>)['text']! as String,
          );
        }
        return null;
      },
    );
    addTearDown(
      () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        null,
      ),
    );
    await openReceive(tester, FakePixRepository());

    await tapButton(tester, 'Copiar código');

    expect(copied, [brunosCode()]);
    expect(find.text('Código copiado.'), findsOneWidget);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('shares the "Copia e Cola" alone', (tester) async {
    final sharer = FakeTextSharer();
    await openReceive(tester, FakePixRepository(), textSharer: sharer);

    await tapButton(tester, 'Compartilhar');

    expect(sharer.shared, [brunosCode()]);
  });

  testWidgets('says why without the key, and tries again', (tester) async {
    final pix = FakePixRepository()
      ..receivingKeyAnswer = () async => throw const ApiUnreachable();
    await openReceive(tester, pix);

    expect(find.byType(QrCodeView), findsNothing);
    expect(find.text('Tentar de novo'), findsOneWidget);

    pix.receivingKeyAnswer = FakePixRepository().receivingKeyAnswer;
    await tester.tap(find.text('Tentar de novo'));
    await tester.pumpAndSettle();

    expect(codeOnScreen(tester), brunosCode());
  });
}
