import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';
import 'package:next_bank/features/pix/presentation/receipt/receipt_screen.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';

import '../support/fake_account_repository.dart';
import '../support/fake_pix_repository.dart';
import '../support/fake_profile_repository.dart';
import '../support/fake_text_sharer.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

// A valid CPF made up for the tests.
const _cpf = '52998224725';
const _endToEndId = 'E00000000202610081732a8F3k9QpZ2x';

/// The text field whose label is [label].
Finder field(String label) => find.byWidgetPredicate(
  (widget) => widget is TextField && widget.decoration?.labelText == label,
);

/// A field of the design system, found by the label above it.
Finder labeled(String label) => find.descendant(
  of: find.widgetWithText(NbTextField, label),
  matching: find.byType(TextField),
);

/// The list that scrolls the screen [type], under the screens beneath it
/// and apart from the text fields' own scrollables.
Finder listOf(Type type) => find
    .descendant(of: find.byType(type), matching: find.byType(Scrollable))
    .first;

/// Signed in with the PIN, unlocked, on the Home.
Future<void> openHome(
  WidgetTester tester,
  FakePixRepository pix, {
  FakeAccountRepository? account,
  FakeTextSharer? sharer,
}) async {
  await pumpApp(
    tester,
    store: FakeTokenStore(tokens),
    pix: pix,
    account: account,
    sharer: sharer,
  );
  await unlockWithPin(tester);
}

/// From the Home to the review: R$ 350,00 to Mariana's CPF key.
Future<void> fillInPix(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Área Pix'));
  await tester.pumpAndSettle();
  await tester.enterText(field('Valor do Pix'), '35000');
  await typeInto(tester, labeled('Chave CPF'), _cpf);
  await tester.ensureVisible(find.text('Buscar chave'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Buscar chave'));
  await tester.pumpAndSettle();
  await typeInto(tester, labeled('Descrição (opcional)'), 'Aluguel de outubro');
}

/// Scrolls the Pix screen to the [field] and types [text] into it.
Future<void> typeInto(WidgetTester tester, Finder field, String text) async {
  await tester.scrollUntilVisible(
    field,
    200,
    scrollable: listOf(SendPixScreen),
  );
  await tester.enterText(field, text);
  await tester.pump();
}

Future<void> reviewPix(WidgetTester tester) async {
  await tester.scrollUntilVisible(
    find.bySemanticsLabel('Revisar Pix'),
    200,
    scrollable: listOf(SendPixScreen),
  );
  await tester.tap(find.bySemanticsLabel('Revisar Pix'));
  await tester.pumpAndSettle();
}

Future<void> typePin(WidgetTester tester, [String pin = '2580']) async {
  await tester.scrollUntilVisible(
    find.byType(PinField),
    200,
    scrollable: listOf(ReviewPixScreen),
  );
  await tester.enterText(find.byType(PinField), pin);
  await tester.pumpAndSettle();
}

/// The server completes the Pix, and reads it as completed from then on.
Future<PixTransfer> Function() completes(FakePixRepository pix) => () async {
  final done = pixTransfer(
    status: PixStatus.completed,
    endToEndId: _endToEndId,
  );
  pix.fetchAnswer = () async => done;
  return done;
};

// Screens 7 to 10 through the real router (domain-model.md 10 and 11).
void main() {
  testWidgets('sends a Pix from the Home to the receipt', (tester) async {
    // Tall enough for the whole receipt to be built at once.
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    final pix = FakePixRepository();
    pix.authorizeAnswer = completes(pix);
    await openHome(tester, pix);

    await fillInPix(tester);
    expect(find.text('Mariana Costa'), findsOneWidget);
    await reviewPix(tester);
    expect(find.text('Revisar Pix'), findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 350,00'), findsOneWidget);
    await typePin(tester);

    final create = pix.callsOf('create').single;
    expect(create.cpf, _cpf);
    expect(create.amountCents, 35000);
    expect(create.description, 'Aluguel de outubro');
    expect(pix.callsOf('authorize').single.pin, '2580');
    expect(find.text('Comprovante'), findsOneWidget);
    expect(find.text('Concluído'), findsOneWidget);
    expect(find.text('Ana Souza'), findsOneWidget);
    expect(find.text('next bank · Ag 0001 · CC •••• 0004'), findsOneWidget);
    expect(find.text('CPF ***.456.789-** · next bank'), findsOneWidget);
    expect(find.text(_endToEndId), findsOneWidget);
  });

  // v1.1.0 plan, task 1: the receipt goes out as the same masked text the
  // screen shows (MOB-09), with the demo notice (DEMO-05).
  testWidgets('shares the receipt of the Pix as text', (tester) async {
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    final pix = FakePixRepository();
    pix.authorizeAnswer = completes(pix);
    final sharer = FakeTextSharer();
    await openHome(tester, pix, sharer: sharer);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester);
    expect(find.text(demoReceiptNotice), findsOneWidget);

    await tester.tap(find.bySemanticsLabel('Compartilhar comprovante'));
    await tester.pumpAndSettle();

    expect(sharer.texts, [
      receiptShareText(
        transfer: await pix.fetchAnswer(),
        payerName: 'Ana Souza',
        payerAccount: 'next bank · Ag 0001 · CC •••• 0004',
      ),
    ]);
  });

  // DEMO-05: a Pix still moving or refused never goes out as a receipt.
  for (final status in [
    PixStatus.processing,
    PixStatus.failed,
    PixStatus.cancelled,
  ]) {
    testWidgets('offers no sharing on a ${status.name} Pix', (tester) async {
      final pix = FakePixRepository()
        ..fetchAnswer = () async => pixTransfer(status: status);
      await openHome(tester, pix);

      GoRouter.of(tester.element(find.byType(Scaffold).last))
          .go(AppRoutes.pixReceipt('pix-1'));
      await tester.pumpAndSettle();

      expect(find.byType(ReceiptScreen), findsOneWidget);
      expect(find.bySemanticsLabel('Compartilhar comprovante'), findsNothing);
      expect(find.text(demoReceiptNotice), findsOneWidget);
    });
  }

  // domain-model.md 10: back from the receipt leads to the Home, never to
  // the PIN.
  testWidgets('goes back from the receipt to the Home', (tester) async {
    final pix = FakePixRepository();
    pix.authorizeAnswer = completes(pix);
    await openHome(tester, pix);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('Área Pix'), findsOneWidget);
    expect(find.byType(PinField), findsNothing);
  });

  // Found on a device: after a Pix of R$ 100,00, the Home showed the movement
  // but still the balance from before it.
  testWidgets('the Home shows the balance after the Pix', (tester) async {
    final account = FakeAccountRepository();
    final pix = FakePixRepository();
    final complete = completes(pix);
    pix.authorizeAnswer = () async {
      account.balanceCents = 1000000 - 35000;
      return await complete();
    };
    await openHome(tester, pix, account: account);
    await showBalance(tester);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);

    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel(r'R$ 9.650,00'), findsOneWidget);
  });

  testWidgets('"Voltar ao início" on the receipt leads to the Home', (
    tester,
  ) async {
    final pix = FakePixRepository();
    pix.authorizeAnswer = completes(pix);
    await openHome(tester, pix);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester);

    await tester.scrollUntilVisible(
      find.bySemanticsLabel('Voltar ao início'),
      200,
      scrollable: listOf(ReceiptScreen),
    );
    await tester.tap(find.bySemanticsLabel('Voltar ao início'));
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('Área Pix'), findsOneWidget);
  });

  testWidgets('back from the review returns to the Pix, as filled', (
    tester,
  ) async {
    final pix = FakePixRepository();
    await openHome(tester, pix);
    await fillInPix(tester);
    await reviewPix(tester);

    await tester.tap(find.bySemanticsLabel('Voltar'));
    await tester.pumpAndSettle();

    expect(find.text('Mariana Costa'), findsOneWidget);
    expect(find.bySemanticsLabel(r'R$ 350,00'), findsOneWidget);
  });

  // MOB-07 end to end: the lost answer is asked again with the same key and
  // PIN, and only "Tentar de novo" is offered meanwhile.
  testWidgets('repeats an authorization whose answer was lost', (tester) async {
    final pix = FakePixRepository()
      ..authorizeAnswer = () async => throw const ApiUnreachable();
    await openHome(tester, pix);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester);

    expect(find.byType(PinField), findsNothing);
    expect(find.textContaining('não será enviado duas vezes'), findsOneWidget);
    pix.authorizeAnswer = completes(pix);
    await tester.tap(find.bySemanticsLabel('Tentar de novo'));
    await tester.pumpAndSettle();

    final keys = pix.callsOf('authorize').map((call) => call.idempotencyKey);
    expect(keys.toSet(), hasLength(1));
    expect(pix.callsOf('authorize'), hasLength(2));
    expect(find.text('Comprovante'), findsOneWidget);
  });

  testWidgets('says how many attempts are left after a wrong PIN', (
    tester,
  ) async {
    final pix = FakePixRepository()
      ..authorizeAnswer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );
    await openHome(tester, pix);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester, '7413');

    expect(find.text('PIN incorreto. Restam 4 tentativas.'), findsOneWidget);
    expect(find.byType(PinField), findsOneWidget);
  });

  testWidgets('offers only to leave when the PIN is locked', (tester) async {
    final pix = FakePixRepository()
      ..authorizeAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.pinLocked);
    await openHome(tester, pix);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester, '7413');

    expect(find.text('PIN bloqueado por 30 minutos.'), findsOneWidget);
    expect(find.byType(PinField), findsNothing);
    expect(find.bySemanticsLabel('Voltar ao início'), findsOneWidget);
  });

  // Catalog: PinNotCreated leads to the PIN creation, found by the week 7
  // sweep (D8) only showing the message.
  testWidgets('leads to the PIN creation when the account has no PIN', (
    tester,
  ) async {
    final profile = FakeProfileRepository();
    final pix = FakePixRepository()
      ..authorizeAnswer = () async {
        profile.hasPin = false;
        throw const ApiRejected(ApiErrorCode.pinNotCreated);
      };
    await pumpApp(
      tester,
      store: FakeTokenStore(tokens),
      profile: profile,
      pix: pix,
    );
    await unlockWithPin(tester);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester);

    expect(find.text('Crie seu PIN'), findsOneWidget);
  });

  testWidgets('asks to start again when the time to confirm is over', (
    tester,
  ) async {
    final pix = FakePixRepository()
      ..authorizeAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.transferExpired);
    await openHome(tester, pix);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester);

    expect(
      find.text('O tempo para confirmar acabou. Comece de novo.'),
      findsOneWidget,
    );
    await tester.tap(find.bySemanticsLabel('Começar de novo'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Revisar Pix'), findsOneWidget);
  });

  // domain-model.md 9: a processed Pix that failed is shown with its reason.
  testWidgets('shows why a processed Pix failed, then goes home', (
    tester,
  ) async {
    final pix = FakePixRepository();
    final failed = pixTransfer(
      status: PixStatus.failed,
      failureReason: PixFailureReason.insufficientFunds,
    );
    pix.authorizeAnswer = () async {
      pix.fetchAnswer = () async => failed;
      return failed;
    };
    await openHome(tester, pix);
    await fillInPix(tester);
    await reviewPix(tester);
    await typePin(tester);

    expect(find.text('Pix não enviado'), findsOneWidget);
    expect(find.text('Saldo insuficiente.'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel('Área Pix'), findsOneWidget);
  });

  testWidgets('says when the key does not exist', (tester) async {
    final pix = FakePixRepository()
      ..lookupAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.pixKeyNotFound);
    await openHome(tester, pix);

    await fillInPix(tester);

    expect(find.text('Não encontramos essa chave Pix.'), findsOneWidget);
    expect(find.byType(ContactCard), findsNothing);
  });

  // MOB-05, week 8 plan V14: the balance, hidden at every opening, stays
  // hidden on the Pix.
  testWidgets('keeps the balance hidden on the Pix', (tester) async {
    await openHome(tester, FakePixRepository());

    await tester.tap(find.bySemanticsLabel('Área Pix'));
    await tester.pumpAndSettle();

    expect(find.textContaining('10.000'), findsNothing);
    expect(find.bySemanticsLabel('Saldo oculto'), findsOneWidget);
  });

  // Brief, section 8: system font scale up to 1.3x on a small phone.
  testWidgets('the Pix fits a small phone at 1.3x text', (tester) async {
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final pix = FakePixRepository();
    pix.authorizeAnswer = completes(pix);
    await openHome(tester, pix);

    await fillInPix(tester);
    expect(tester.takeException(), isNull);
    await reviewPix(tester);
    expect(tester.takeException(), isNull);
    await typePin(tester);
    expect(tester.takeException(), isNull);
  });
}
