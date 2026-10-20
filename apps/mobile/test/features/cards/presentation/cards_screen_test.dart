import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/ui/cards/payment_card.dart';
import 'package:next_bank/features/cards/presentation/cards_screen.dart';

import '../../../support/device_stores.dart';
import '../../../support/fake_profile_repository.dart';
import '../../../support/fake_token_store.dart';

Future<void> pumpCards(
  WidgetTester tester, {
  int initialIndex = 0,
  VoidCallback? onBack,
}) async {
  tester.view.physicalSize = const Size(1080, 4000);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        ...deviceStoreOverrides(),
        tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
        profileRepositoryProvider.overrideWithValue(FakeProfileRepository()),
      ],
      child: MaterialApp(
        theme: NbTheme.dark(),
        home: CardsScreen(initialIndex: initialIndex, onBack: onBack ?? () {}),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

/// Swipes the carousel to the credit card.
Future<void> swipeToCredit(WidgetTester tester) async {
  await tester.drag(find.byType(PageView), const Offset(-500, 0));
  await tester.pumpAndSettle();
}

Finder comingSoon() => find.widgetWithText(NbToast, 'Em breve.');

// The cards, layout only (v1.1.0 plan, task 4.14): a carousel of a debit
// and a credit card, the content below following the card.
void main() {
  testWidgets('opens on the debit card, its content below', (tester) async {
    await pumpCards(tester);

    expect(find.byType(PaymentCard), findsNWidgets(2));
    expect(find.text('Ana Souza · •••• 0001 · Débito'), findsOneWidget);
    expect(find.text('Cartão desbloqueado'), findsOneWidget);
    expect(find.text('Configurações rápidas'), findsOneWidget);
    expect(find.text('Fatura atual'), findsNothing);
  });

  // As the reference: the next card shows cut at the edge, so it reads as
  // something to swipe.
  testWidgets('shows a piece of the next card at the edge', (tester) async {
    await pumpCards(tester);

    final screen = tester.getSize(find.byType(CardsScreen)).width;
    final next = tester.getTopLeft(find.byType(PaymentCard).last).dx;
    expect(next, lessThan(screen));
    expect(next, greaterThan(screen / 2));
  });

  testWidgets('swipes to the credit card, its content replacing the debit', (
    tester,
  ) async {
    await pumpCards(tester);

    await swipeToCredit(tester);

    expect(find.text('Ana Souza · •••• 0002 · Crédito'), findsOneWidget);
    expect(find.text('Fatura atual'), findsOneWidget);
    expect(find.text(r'R$ 1.250,40'), findsOneWidget);
    expect(find.text('Últimas compras'), findsOneWidget);
    expect(find.text('Cartão desbloqueado'), findsNothing);
  });

  // v1.1.0 plan, task 4.15: the Home's Detalhes opens the card tapped.
  testWidgets('opens on the card asked for', (tester) async {
    await pumpCards(tester, initialIndex: 1);

    expect(find.text('Ana Souza · •••• 0002 · Crédito'), findsOneWidget);
    expect(find.text('Fatura atual'), findsOneWidget);
  });

  // Repository rules: a generic brand, never a real one's name.
  testWidgets('marks the cards with a generic brand', (tester) async {
    await pumpCards(tester);

    expect(find.byType(CardBrandMark), findsNWidgets(2));
    for (final brand in ['Mastercard', 'Visa', 'Elo']) {
      expect(find.textContaining(brand), findsNothing, reason: brand);
    }
  });

  // S21 checkpoint: the lock toggles between locked and unlocked, on the
  // screen only for now.
  testWidgets('toggles the lock between locked and unlocked', (tester) async {
    await pumpCards(tester);

    await tester.tap(find.widgetWithText(TextButton, 'Bloquear'));
    await tester.pumpAndSettle();
    expect(find.text('Cartão bloqueado'), findsOneWidget);
    expect(find.byIcon(Icons.lock), findsOneWidget);
    expect(find.widgetWithText(NbToast, 'Em breve.'), findsNothing);

    await tester.tap(find.widgetWithText(TextButton, 'Desbloquear'));
    await tester.pumpAndSettle();
    expect(find.text('Cartão desbloqueado'), findsOneWidget);
    expect(find.byIcon(Icons.lock_open), findsOneWidget);
  });

  for (final label in ['Ativar', 'Exibir senha']) {
    testWidgets('says "$label" on the debit card is coming', (tester) async {
      await pumpCards(tester);

      await tester.tap(find.bySemanticsLabel(label).first);
      await tester.pumpAndSettle();

      expect(comingSoon(), findsOneWidget);
    });
  }

  // S21 checkpoint: a back arrow, as on the Pix screen.
  testWidgets('goes back where the app says', (tester) async {
    var back = 0;
    await pumpCards(tester, onBack: () => back++);

    await tester.tap(find.bySemanticsLabel('Voltar'));

    expect(back, 1);
  });

  testWidgets('says Pagar fatura is coming', (tester) async {
    await pumpCards(tester);
    await swipeToCredit(tester);

    await tester.tap(find.text('Pagar fatura'));
    await tester.pumpAndSettle();

    expect(comingSoon(), findsOneWidget);
  });

  for (final credit in [false, true]) {
    testWidgets(
      'fits a small phone at 1.3x text on the ${credit ? 'credit' : 'debit'}',
      (tester) async {
        await pumpCards(tester);
        if (credit) await swipeToCredit(tester);
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
