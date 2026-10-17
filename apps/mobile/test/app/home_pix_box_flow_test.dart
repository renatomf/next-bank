import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/home/presentation/widgets/home_pix_box.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/automatic/pix_automatic_screen.dart';
import 'package:next_bank/features/pix/presentation/keys/pix_keys_screen.dart';
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
      of: find.byType(HomePixBox),
      matching: find.bySemanticsLabel(label),
    ),
  );
  await tester.pumpAndSettle();
}

// The Home's Pix box (v1.1.0 plan, task 4.2) through the real router.
void main() {
  testWidgets('opens the Pix with the CPF typed, looked up at once', (
    tester,
  ) async {
    final pix = FakePixRepository();
    await openHome(tester, pix);

    await tester.enterText(
      find.descendant(
        of: find.byType(HomePixBox),
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
    // The holder the server returns (PIX-11), and the key shown in its field.
    expect(find.text('Mariana Costa'), findsOneWidget);
    expect(find.text('529.982.247-25'), findsOneWidget);
  });

  for (final (label, screen) in [
    ('Transferir Pix', TransferPixScreen),
    ('Pix Automático', PixAutomaticScreen),
    ('Minhas chaves', PixKeysScreen),
  ]) {
    testWidgets('opens "$label", blank for now, and goes back', (tester) async {
      await openHome(tester, FakePixRepository());

      await tapInBox(tester, label);

      expect(find.byType(screen), findsOneWidget);
      expect(find.text(label), findsWidgets);

      await tester.tap(find.bySemanticsLabel('Voltar'));
      await tester.pumpAndSettle();

      expect(find.byType(HomeScreen), findsOneWidget);
    });
  }
}
