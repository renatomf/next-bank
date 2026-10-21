import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/top_up/domain/carrier.dart';
import 'package:next_bank/features/top_up/presentation/amount/recharge_amount_screen.dart';
import 'package:next_bank/features/top_up/presentation/example_recharges.dart';
import 'package:next_bank/features/top_up/presentation/recharge_screen.dart';

Future<void> pumpScreen(WidgetTester tester, Widget screen) async {
  tester.view.physicalSize = const Size(1080, 3000);
  addTearDown(tester.view.reset);
  await tester.pumpWidget(MaterialApp(theme: NbTheme.dark(), home: screen));
  await tester.pumpAndSettle();
}

Future<void> fitSmallPhone(WidgetTester tester) async {
  tester.view
    ..physicalSize = const Size(320 * 3, 568 * 3)
    ..devicePixelRatio = 3;
  tester.platformDispatcher.textScaleFactorTestValue = 1.3;
  addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
  await tester.pumpAndSettle();
  expect(tester.takeException(), isNull);
}

Finder comingSoon() => find.widgetWithText(NbToast, 'Em breve.');

// Recharges, layout only (v1.1.0 plan, task 4.12): made-up numbers, the
// carriers with initials in place of logos.
void main() {
  group('Recargas', () {
    Future<void> pumpRecharges(
      WidgetTester tester, {
      VoidCallback? onBack,
      void Function(Carrier, String)? onCarrier,
    }) => pumpScreen(
      tester,
      RechargeScreen(
        onBack: onBack ?? () {},
        onCarrier: onCarrier ?? (_, _) {},
      ),
    );

    testWidgets('shows the recent recharges and the carriers', (tester) async {
      await pumpRecharges(tester);

      expect(find.text('Recargas recentes'), findsOneWidget);
      expect(find.text('(11) 90000-0001'), findsOneWidget);
      expect(find.text('(11) 90000-0002'), findsOneWidget);
      expect(find.text('Ver todos'), findsOneWidget);
      for (final carrier in phoneCarriers) {
        expect(
          find.bySemanticsLabel(carrier.name),
          findsOneWidget,
          reason: carrier.name,
        );
      }
      expect(find.text('VI'), findsWidgets);
    });

    testWidgets('opens a carrier for the customer number', (tester) async {
      final opened = <(Carrier, String)>[];
      await pumpRecharges(
        tester,
        onCarrier: (carrier, phone) => opened.add((carrier, phone)),
      );

      await tester.tap(find.bySemanticsLabel('Vivo'));

      expect(opened, [(carrierById('vivo')!, examplePhone)]);
    });

    testWidgets('opens a recent recharge for its own number', (tester) async {
      final opened = <(Carrier, String)>[];
      await pumpRecharges(
        tester,
        onCarrier: (carrier, phone) => opened.add((carrier, phone)),
      );

      await tester.tap(find.bySemanticsLabel(RegExp('90000-0002')));

      final recent = exampleRecentRecharges[1];
      expect(opened, [(carrierById(recent.carrierId)!, recent.phone)]);
    });

    testWidgets('says Ver todos is coming', (tester) async {
      await pumpRecharges(tester);

      // The last card, past the screen's edge: scrolled into view first.
      await tester.ensureVisible(find.bySemanticsLabel('Ver todos'));
      await tester.pumpAndSettle();
      await tester.tap(find.bySemanticsLabel('Ver todos'));
      await tester.pumpAndSettle();

      expect(comingSoon(), findsOneWidget);
    });

    testWidgets('goes back where the app says', (tester) async {
      var back = 0;
      await pumpRecharges(tester, onBack: () => back++);

      await tester.tap(find.bySemanticsLabel('Voltar'));

      expect(back, 1);
    });

    testWidgets('fits a small phone at 1.3x text', (tester) async {
      await pumpRecharges(tester);
      await fitSmallPhone(tester);
    });
  });

  group('the recharge amount', () {
    Future<void> pumpAmount(WidgetTester tester, {VoidCallback? onBack}) =>
        pumpScreen(
          tester,
          RechargeAmountScreen(
            carrier: carrierById('vivo')!,
            phone: '(11) 90000-0001',
            onBack: onBack ?? () {},
          ),
        );

    testWidgets('shows the carrier, the number and the amounts', (
      tester,
    ) async {
      await pumpAmount(tester);

      expect(find.text('Recarga de celular Vivo'), findsOneWidget);
      expect(
        find.text('Escolha o valor da recarga para (11) 90000-0001'),
        findsOneWidget,
      );
      expect(find.text('Valor da recarga'), findsOneWidget);
      for (final amount in [r'R$ 20', r'R$ 30', r'R$ 100']) {
        expect(find.widgetWithText(FilterPill, amount), findsOneWidget);
      }
      expect(find.byType(FilterPill), findsNWidgets(7));
    });

    testWidgets('picks one amount at a time', (tester) async {
      await pumpAmount(tester);
      bool isOn(String amount) => tester
          .widget<FilterPill>(find.widgetWithText(FilterPill, amount))
          .selected;

      await tester.tap(find.widgetWithText(FilterPill, r'R$ 30'));
      await tester.pumpAndSettle();
      expect(isOn(r'R$ 30'), isTrue);

      await tester.tap(find.widgetWithText(FilterPill, r'R$ 50'));
      await tester.pumpAndSettle();
      expect(isOn(r'R$ 50'), isTrue);
      expect(isOn(r'R$ 30'), isFalse);
    });

    testWidgets('says Continuar is coming', (tester) async {
      await pumpAmount(tester);

      await tester.tap(find.text('Continuar'));
      await tester.pumpAndSettle();

      expect(comingSoon(), findsOneWidget);
    });

    testWidgets('goes back where the app says', (tester) async {
      var back = 0;
      await pumpAmount(tester, onBack: () => back++);

      await tester.tap(find.bySemanticsLabel('Voltar'));

      expect(back, 1);
    });

    testWidgets('fits a small phone at 1.3x text', (tester) async {
      await pumpAmount(tester);
      await fitSmallPhone(tester);
    });
  });
}
