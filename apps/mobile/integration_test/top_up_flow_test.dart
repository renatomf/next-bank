import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/top_up/presentation/amount/top_up_amount_screen.dart';
import 'package:next_bank/features/top_up/presentation/confirm/confirm_top_up_screen.dart';
import 'package:next_bank/features/top_up/presentation/receipt/top_up_receipt_screen.dart';
import 'package:next_bank/main.dart' as app;

import 'support/e2e.dart';

// A phone top-up, end to end (v1.1.0 plan, task 5b): the operators from the
// real API, a made-up number (TOP-01), the PIN checked on the server, the
// receipt, and the statement with the top-up linking to it. R$ 15,00, the
// smallest amount, so local reruns stay far from the day's limit. Run as
// critical_flow_test.dart says.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login → top-up → receipt → statement', (tester) async {
    final semantics = tester.ensureSemantics();
    await app.main();
    await signIn(tester, email: anaEmail, password: anaPassword);

    await scrollAndTap(
      tester,
      HomeScreen,
      find.widgetWithText(ActionTile, 'Recarga'),
    );
    await waitFor(tester, find.bySemanticsLabel('Pulso Celular'));
    await tester.tap(find.bySemanticsLabel('Pulso Celular'));
    await waitFor(tester, find.byType(TopUpAmountScreen));

    await tester.enterText(
      find.descendant(
        of: find.widgetWithText(NbTextField, 'Número do celular'),
        matching: find.byType(TextField),
      ),
      '(11) 90000-0001',
    );
    await scrollAndTap(tester, TopUpAmountScreen, find.text(r'R$ 15'));
    FocusManager.instance.primaryFocus?.unfocus();
    await tester.pumpAndSettle();
    await tester.tap(find.bySemanticsLabel('Continuar'));
    await waitFor(tester, find.byType(ConfirmTopUpScreen));

    await tester.scrollUntilVisible(
      find.byType(PinField),
      200,
      scrollable: find
          .descendant(
            of: find.byType(ConfirmTopUpScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.enterText(find.byType(PinField), anaPin);
    await waitFor(tester, find.text('Recarga feita'));
    expect(find.text('Celular (11) *****-0001'), findsOneWidget);

    // Back home, the statement shows the top-up, which opens its receipt.
    await scrollAndTap(
      tester,
      TopUpReceiptScreen,
      find.text('Voltar ao início'),
    );
    await waitFor(tester, find.byType(HomeScreen));
    await scrollAndTap(
      tester,
      HomeScreen,
      find.bySemanticsLabel('Ver extrato'),
    );
    await waitFor(tester, find.text('Recarga de celular'));
    await tester.tap(find.text('Recarga de celular').first);
    await waitFor(tester, find.text('Ver comprovante'));
    await tester.tap(find.text('Ver comprovante'));
    await waitFor(tester, find.text('Recarga feita'));

    semantics.dispose();
  });
}
