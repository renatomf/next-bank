import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_box.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/automatic/pix_automatic_screen.dart';
import 'package:next_bank/features/pix/presentation/keys/pix_keys_screen.dart';
import 'package:next_bank/features/pix/presentation/scan/scan_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/transfer/transfer_pix_screen.dart';

import '../support/fake_pix_repository.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

// A valid CPF made up for the tests.
const _cpf = '52998224725';

/// Signed in, unlocked, on the Home, tall enough to show the Pix box.
Future<void> openHome(WidgetTester tester, FakePixRepository pix) async {
  tester.view.physicalSize = const Size(1080, 3600);
  addTearDown(tester.view.reset);
  await pumpApp(tester, store: FakeTokenStore(tokens), pix: pix);
  await unlockWithPin(tester);
}

Future<void> tapInBox(WidgetTester tester, String label) async {
  await tester.tap(
    find.descendant(
      of: find.byType(PixBox),
      matching: find.bySemanticsLabel(label),
    ),
  );
  await tester.pumpAndSettle();
}

// The Home's Pix box (v1.1.0 plan, task 4.2) through the real router.
void main() {
  // v1.1.0 plan, task 4.9: the Home's shortcut opens the transfer too.
  testWidgets('opens Transferir from the Home shortcut, and back', (
    tester,
  ) async {
    await openHome(tester, FakePixRepository());

    await tester.tap(find.widgetWithText(ActionTile, 'Transferir'));
    await tester.pumpAndSettle();
    expect(find.byType(TransferPixScreen), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Voltar'));
    await tester.pumpAndSettle();
    expect(find.byType(HomeScreen), findsOneWidget);
  });

  // S21 checkpoint: the transfer's camera opens the reading, as "Pagar".
  testWidgets("opens the QR Code reading from Transferir's camera", (
    tester,
  ) async {
    await openHome(tester, FakePixRepository());
    await tester.tap(find.widgetWithText(ActionTile, 'Transferir'));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Ler QR Code'));
    await tester.pumpAndSettle();

    expect(find.byType(ScanPixScreen), findsOneWidget);
  });

  testWidgets('opens the Pix with the CPF typed, looked up at once', (
    tester,
  ) async {
    final pix = FakePixRepository();
    await openHome(tester, pix);

    await tester.enterText(
      find.descendant(
        of: find.byType(PixBox),
        matching: find.byType(TextField),
      ),
      _cpf,
    );
    await tapInBox(tester, 'Continuar com a chave');

    expect(find.byType(SendPixScreen), findsOneWidget);
    expect(pix.callsOf('lookup').single.key, (
      type: PixKeyType.cpf,
      value: _cpf,
    ));
    // The holder the server returns (PIX-11), and the key in its field as
    // typed: one field takes every kind of key (v1.2.0 plan, task 5, A1).
    expect(find.text('Mariana Costa'), findsOneWidget);
    expect(find.text(_cpf), findsOneWidget);
  });

  // Each with its own title: "Transferir Pix" opens Transferir.
  for (final (label, screen, title) in [
    ('Transferir Pix', TransferPixScreen, 'Transferir'),
    ('Pix Automático', PixAutomaticScreen, 'Pix Automático'),
    ('Minhas chaves', PixKeysScreen, 'Minhas chaves'),
  ]) {
    testWidgets('opens "$label" and goes back', (tester) async {
      await openHome(tester, FakePixRepository());

      await tapInBox(tester, label);

      expect(find.byType(screen), findsOneWidget);
      expect(find.widgetWithText(ScreenHeader, title), findsOneWidget);

      await tester.tap(find.bySemanticsLabel('Voltar'));
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });
  }
}
