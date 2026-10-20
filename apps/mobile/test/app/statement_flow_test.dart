import 'dart:async';

import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/redirect.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_query.dart';
import 'package:next_bank/core/ui/balance/balance_card.dart';
import 'package:next_bank/core/ui/statement/transaction_item.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';
import 'package:next_bank/features/statement/presentation/list/statement_screen.dart';

import '../support/fake_pix_repository.dart';
import '../support/fake_statement_repository.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

StatementPage pageOf(List<StatementItem> items, [String? nextCursor]) =>
    (items: items, nextCursor: nextCursor);

final StatementItem received = movement('received');
final StatementItem sent = movement(
  'sent',
  kind: StatementKind.pixSent,
  amountCents: 12000,
  transferId: 'pix-1',
);
final StatementItem funding = movement(
  'funding',
  kind: StatementKind.demoFunding,
  amountCents: 1000000,
);

/// Signed in with the PIN, unlocked, on the Home.
Future<void> openHome(
  WidgetTester tester,
  FakeStatementRepository statement, {
  FakePixRepository? pix,
}) async {
  // Tall enough for the Home's latest movements to be built at once.
  tester.view.physicalSize = const Size(1080, 3600);
  addTearDown(tester.view.reset);
  await pumpApp(
    tester,
    store: FakeTokenStore(tokens),
    statement: statement,
    pix: pix,
  );
  await unlockWithPin(tester);
}

Future<void> openStatement(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Ver extrato'));
  await tester.pumpAndSettle();
}

/// The movement rows of the statement screen.
Finder statementRows() => find.descendant(
  of: find.byType(StatementScreen),
  matching: find.byType(TransactionItem),
);

// Screens 11 and 12 through the real router (domain-model.md 10 and 11).
void main() {
  // v1.1.0 plan, task 4.2: the Home's latest movements gave way to the Pix
  // box; the movements live on the statement, opened from the balance card.
  testWidgets('the Home no longer lists movements', (tester) async {
    await openHome(
      tester,
      FakeStatementRepository({
        null: () async => pageOf([received]),
      }),
    );

    expect(find.text('Últimas movimentações'), findsNothing);
    expect(
      find.descendant(
        of: find.byType(HomeScreen),
        matching: find.byType(TransactionItem),
      ),
      findsNothing,
    );
  });

  group('the statement', () {
    testWidgets('shows a skeleton while the first page loads', (tester) async {
      final first = Completer<StatementPage>();
      await openHome(
        tester,
        FakeStatementRepository({null: () => first.future}),
      );

      await tester.tap(find.bySemanticsLabel('Ver extrato'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 400));

      expect(find.bySemanticsLabel('Carregando o extrato'), findsOneWidget);
      first.complete(pageOf([received]));
      await tester.pumpAndSettle();
    });

    testWidgets('lists the movements and says when there are no more', (
      tester,
    ) async {
      await openHome(
        tester,
        FakeStatementRepository({
          null: () async => pageOf([received, sent]),
        }),
      );

      await openStatement(tester);

      expect(statementRows(), findsNWidgets(2));
      expect(find.text('Não há movimentações mais antigas.'), findsOneWidget);
    });

    testWidgets('asks the next page near the end of the list', (tester) async {
      final statement = FakeStatementRepository({
        null: () async =>
            pageOf([for (var i = 0; i < 20; i++) movement('a$i')], 'c1'),
        'c1': () async => pageOf([movement('b0')]),
      });
      await openHome(tester, statement);
      await openStatement(tester);

      await tester.scrollUntilVisible(
        find.text('Não há movimentações mais antigas.'),
        300,
        scrollable: find
            .descendant(
              of: find.byType(StatementScreen),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.pumpAndSettle();

      // Only the statement reads it: the Home no longer lists movements
      // (v1.1.0 plan, task 4.2).
      expect(statement.cursors, [null, 'c1']);
      expect(find.text('Não há movimentações mais antigas.'), findsOneWidget);
    });

    testWidgets('offers a retry when the next page fails', (tester) async {
      var fails = true;
      final statement = FakeStatementRepository({
        null: () async => pageOf([received], 'c1'),
        'c1': () async =>
            fails ? throw const ApiUnreachable() : pageOf([funding]),
      });
      await openHome(tester, statement);
      await openStatement(tester);

      expect(find.text('Sem conexão. Tente de novo.'), findsOneWidget);
      fails = false;
      await tester.tap(
        find.descendant(
          of: find.byType(StatementScreen),
          matching: find.text('Tentar de novo'),
        ),
      );
      await tester.pumpAndSettle();

      expect(statementRows(), findsNWidgets(2));
    });

    testWidgets('says when there is no movement yet', (tester) async {
      await openHome(tester, FakeStatementRepository());

      await openStatement(tester);

      expect(
        find.descendant(
          of: find.byType(StatementScreen),
          matching: find.text('Sem movimentações'),
        ),
        findsOneWidget,
      );
    });
  });

  group('the detail', () {
    testWidgets('shows a movement received, without a receipt (D3)', (
      tester,
    ) async {
      await openHome(
        tester,
        FakeStatementRepository({
          null: () async => pageOf([received]),
        }),
      );
      await openStatement(tester);

      await tester.tap(statementRows().first);
      await tester.pumpAndSettle();

      expect(find.text('Detalhe'), findsOneWidget);
      expect(find.text('Entrada'), findsOneWidget);
      expect(find.bySemanticsLabel(r'R$ 350,00'), findsOneWidget);
      expect(find.text('Mariana Costa'), findsOneWidget);
      expect(find.text('CPF ***.456.789-** · next bank'), findsOneWidget);
      expect(find.bySemanticsLabel('Ver comprovante'), findsNothing);
    });

    // domain-model.md 10: Extrato → Detalhe → Comprovante, and back (T4-3).
    testWidgets('opens the receipt of a Pix sent and comes back to it', (
      tester,
    ) async {
      final pix = FakePixRepository()
        ..fetchAnswer = () async =>
            pixTransfer(status: PixStatus.completed, endToEndId: 'E1');
      await openHome(
        tester,
        FakeStatementRepository({
          null: () async => pageOf([sent]),
        }),
        pix: pix,
      );
      await openStatement(tester);
      await tester.tap(statementRows().first);
      await tester.pumpAndSettle();

      await tester.tap(find.bySemanticsLabel('Ver comprovante'));
      await tester.pumpAndSettle();
      expect(find.text('Comprovante'), findsOneWidget);
      expect(pix.callsOf('fetch').single.transferId, 'pix-1');

      await tester.binding.handlePopRoute();
      await tester.pumpAndSettle();
      expect(find.text('Detalhe'), findsOneWidget);
    });

    // domain-model.md 11, screen 12: a movement the statement does not hold,
    // e.g. from an old link.
    testWidgets('says when the movement is not found', (tester) async {
      await openHome(
        tester,
        FakeStatementRepository({
          null: () async => pageOf([received]),
        }),
      );

      GoRouter.of(tester.element(find.byType(Scaffold).last))
          .go(AppRoutes.statementItem('unknown'));
      await tester.pumpAndSettle();

      expect(find.text('Não encontrado.'), findsOneWidget);
    });
  });

  // Brief, section 8: system font scale up to 1.3x on a small phone.
  testWidgets('the statement fits a small phone at 1.3x text', (tester) async {
    await openHome(
      tester,
      FakeStatementRepository({
        null: () async => pageOf([received, sent, funding]),
      }),
    );
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.bySemanticsLabel('Ver extrato'),
      200,
      scrollable: find
          .descendant(
            of: find.byType(HomeScreen),
            matching: find.byType(Scrollable),
          )
          .first,
    );
    await tester.ensureVisible(find.bySemanticsLabel('Ver extrato'));
    await tester.pumpAndSettle();
    await openStatement(tester);
    expect(tester.takeException(), isNull);
    // The card, filters and search fill a small screen: the rows come below.
    final list = find
        .descendant(
          of: find.byType(StatementScreen),
          matching: find.byType(Scrollable),
        )
        .first;
    await tester.scrollUntilVisible(
      find.descendant(
        of: find.byType(StatementScreen),
        matching: find.text('Pix recebido'),
      ),
      200,
      scrollable: list,
    );
    // Clear of the floating bar, which covers the bottom of the list.
    await tester.drag(list, const Offset(0, -150));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.tap(statementRows().first);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  // Week 8 plan, V1: a failed pull keeps the list and says so on top.
  testWidgets('keeps the list when a pull fails, saying so on top', (
    tester,
  ) async {
    var offline = false;
    await openHome(
      tester,
      FakeStatementRepository({
        null: () async {
          if (offline) throw const ApiUnreachable();
          return pageOf([received, sent]);
        },
      }),
    );
    await openStatement(tester);

    offline = true;
    await tester.fling(
      find
          .descendant(
            of: find.byType(StatementScreen),
            matching: find.byType(Scrollable),
          )
          .first,
      const Offset(0, 400),
      1000,
    );
    await tester.pumpAndSettle();

    expect(statementRows(), findsNWidgets(2));
    expect(find.byType(ErrorState), findsNothing);
    expect(
      find.descendant(
        of: find.byType(NbToast),
        matching: find.text('Sem conexão. Tente de novo.'),
      ),
      findsOneWidget,
    );
  });

  // The redesigned statement (v1.1.0 plan, task 4.1): the balance card with
  // its actions, one filter at a time and the search, both on the server.
  group('redesigned', () {
    testWidgets('shows the balance card with its three actions', (
      tester,
    ) async {
      await openHome(tester, FakeStatementRepository());
      await openStatement(tester);

      expect(find.byType(BalanceCard), findsOneWidget);
      for (final action in ['Exportar', 'Pagar', 'Fazer Pix']) {
        expect(find.bySemanticsLabel(action), findsWidgets);
      }
    });

    testWidgets('says exporting is coming', (tester) async {
      await openHome(tester, FakeStatementRepository());
      await openStatement(tester);

      await tester.tap(
        find.descendant(
          of: find.byType(BalanceCard),
          matching: find.bySemanticsLabel('Exportar'),
        ),
      );
      await tester.pump();

      expect(find.widgetWithText(NbToast, 'Em breve.'), findsOneWidget);
      await tester.pump(const Duration(seconds: 5));
    });

    testWidgets('opens the Pix from "Fazer Pix"', (tester) async {
      await openHome(tester, FakeStatementRepository());
      await openStatement(tester);

      await tester.tap(
        find.descendant(
          of: find.byType(BalanceCard),
          matching: find.bySemanticsLabel('Fazer Pix'),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(SendPixScreen), findsOneWidget);
    });

    testWidgets('asks the server with one filter, cleared by a second tap', (
      tester,
    ) async {
      final statement = FakeStatementRepository();
      await openHome(tester, statement);
      await openStatement(tester);

      await tester.tap(find.bySemanticsLabel('Entrada'));
      await tester.pumpAndSettle();

      expect(statement.queries.last.filter, StatementFilter.incoming);

      await tester.tap(find.bySemanticsLabel('Entrada'));
      await tester.pumpAndSettle();

      expect(statement.queries.last, allMovements);
    });

    testWidgets('searches by name after a pause in the typing', (tester) async {
      final statement = FakeStatementRepository();
      await openHome(tester, statement);
      await openStatement(tester);

      await tester.enterText(
        find.descendant(
          of: find.byType(StatementScreen),
          matching: find.byType(TextField),
        ),
        'mari',
      );
      await tester.pump(const Duration(milliseconds: 100));

      expect(statement.queries.last.search, isNull);

      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(statement.queries.last.search, 'mari');
    });

    testWidgets('says nothing was found for a filter without movements', (
      tester,
    ) async {
      late final FakeStatementRepository statement;
      statement = FakeStatementRepository({
        null: () async => statement.queries.last == allMovements
            ? pageOf([received, sent])
            : pageOf([]),
      });
      await openHome(tester, statement);
      await openStatement(tester);

      // The pills scroll sideways: the last one may start off screen.
      await tester.scrollUntilVisible(
        find.bySemanticsLabel('Comprovante'),
        100,
        scrollable: find
            .descendant(
              of: find
                  .ancestor(
                    of: find.byType(FilterPill).first,
                    matching: find.byType(ListView),
                  )
                  .first,
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await tester.ensureVisible(find.bySemanticsLabel('Comprovante'));
      await tester.pumpAndSettle();
      await tester.tap(find.bySemanticsLabel('Comprovante'));
      await tester.pumpAndSettle();

      expect(find.text('Nada encontrado'), findsOneWidget);
      expect(statementRows(), findsNothing);
    });

    testWidgets('hides and shows the balance with the eye (MOB-05)', (
      tester,
    ) async {
      await openHome(tester, FakeStatementRepository());
      await openStatement(tester);

      expect(
        find.descendant(
          of: find.byType(BalanceCard),
          matching: find.bySemanticsLabel('Saldo oculto'),
        ),
        findsOneWidget,
      );

      // The eye lives in the card now, as on the Home; the top has back and
      // "Extrato" centered.
      expect(find.bySemanticsLabel('Mostrar saldo'), findsOneWidget);
      expect(find.widgetWithText(ScreenHeader, 'Extrato'), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(BalanceCard),
          matching: find.bySemanticsLabel('Mostrar saldo'),
        ),
      );
      await tester.pumpAndSettle();

      expect(
        find.descendant(
          of: find.byType(BalanceCard),
          matching: find.bySemanticsLabel('Saldo oculto'),
        ),
        findsNothing,
      );
    });
  });
}
