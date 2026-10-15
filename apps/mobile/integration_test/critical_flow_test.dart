import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/pix/presentation/receipt/receipt_screen.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/main.dart' as app;

import 'support/e2e.dart';

// The critical flow, end to end (CLAUDE.md, Testes; week 8 plan, E2E): the
// real app on an emulator against the real API and Postgres, with the demo
// accounts the seed creates (apps/api/scripts/seed-demo.ts). Locally, with
// the database up and the API running (apps/api: pnpm seed:demo once):
//   flutter test integration_test -d emulator-5554 \
//     --dart-define=API_BASE_URL=http://10.0.2.2:3000
// In CI: .github/workflows/e2e.yml.

/// The available balance on the Home card, in cents.
int balanceOnHome(WidgetTester tester) {
  final amount = RegExp(r'^R\$ ([\d.]+),(\d\d)$');
  final label = find
      .descendant(
        of: find.byType(BalanceCard),
        matching: find.bySemanticsLabel(amount),
      )
      .evaluate()
      .map((element) => tester.getSemantics(find.byWidget(element.widget)))
      .map((node) => node.label)
      .first;
  final match = amount.firstMatch(label)!;
  return int.parse(match.group(1)!.replaceAll('.', '')) * 100 +
      int.parse(match.group(2)!);
}

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('login → Pix → receipt → statement', (tester) async {
    final semantics = tester.ensureSemantics();
    await app.main();

    await signIn(tester, email: anaEmail, password: anaPassword);
    await waitFor(tester, find.bySemanticsLabel('Mostrar saldo'));
    await tester.tap(find.bySemanticsLabel('Mostrar saldo'));
    await waitFor(tester, find.bySemanticsLabel(RegExp(r'^R\$ ')));
    final before = balanceOnHome(tester);

    // Pix of R$ 1,00 to Bruno's CPF key.
    await tester.tap(find.bySemanticsLabel('Área Pix'));
    await waitFor(tester, find.text('Buscar chave'));
    await tester.enterText(
      find.byWidgetPredicate(
        (widget) =>
            widget is TextField &&
            widget.decoration?.labelText == 'Valor do Pix',
      ),
      '100',
    );
    final keyField = find.descendant(
      of: find.widgetWithText(NbTextField, 'Chave CPF'),
      matching: find.byType(TextField),
    );
    await tester.enterText(keyField, brunoCpf);
    await tester.pump();
    await scrollAndTap(tester, SendPixScreen, find.text('Buscar chave'));
    await waitFor(tester, find.text('Bruno Demo'));
    await scrollAndTap(tester, SendPixScreen, find.text('Revisar Pix'));

    // Review and PIN, checked on the server.
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
    expect(find.bySemanticsLabel(r'R$ 1,00'), findsWidgets);

    // Back home, the balance is exactly R$ 1,00 lower.
    await scrollAndTap(tester, ReceiptScreen, find.text('Voltar ao início'));
    await waitFor(tester, find.byType(BalanceCard));
    if (find.bySemanticsLabel('Mostrar saldo').evaluate().isNotEmpty) {
      await tester.tap(find.bySemanticsLabel('Mostrar saldo'));
      await tester.pumpAndSettle();
    }
    await waitFor(tester, find.bySemanticsLabel(RegExp(r'^R\$ ')));
    expect(balanceOnHome(tester), before - 100);

    // The statement shows the Pix sent, and its detail opens the receipt.
    await scrollAndTap(tester, HomeScreen, find.text('Ver extrato'));
    await waitFor(tester, find.text('Pix enviado'));
    await tester.tap(find.text('Pix enviado').first);
    await waitFor(tester, find.text('Ver comprovante'));
    await tester.tap(find.text('Ver comprovante'));
    await waitFor(tester, find.text('Concluído'));

    semantics.dispose();
  });
}
