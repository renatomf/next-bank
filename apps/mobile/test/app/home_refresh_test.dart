import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/statement/statement_item.dart';

import '../support/fake_account_repository.dart';
import '../support/fake_statement_repository.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

/// The states a phone goes through to the background and back, in the order
/// Flutter requires.
void goToBackgroundAndBack(WidgetTester tester) => [
  AppLifecycleState.inactive,
  AppLifecycleState.hidden,
  AppLifecycleState.paused,
  AppLifecycleState.hidden,
  AppLifecycleState.inactive,
  AppLifecycleState.resumed,
].forEach(tester.binding.handleAppLifecycleStateChanged);

/// A statement whose first page the test can change, as new money arrives.
({FakeStatementRepository repository, void Function(List<String>) arrive})
statementOf(List<String> ids) {
  var current = ids;
  final repository = FakeStatementRepository({
    null: () async => (
      items: [
        for (final id in current)
          movement(
            id,
            kind: id == 'funding'
                ? StatementKind.demoFunding
                : StatementKind.pixReceived,
          ),
      ],
      nextCursor: null,
    ),
  });
  return (repository: repository, arrive: (ids) => current = ids);
}

// Found on a device: with the app open, a Pix received never showed in the
// balance. The Home reads it again when the app comes back and when the
// customer pulls it down. (Its latest movements left in v1.1.0, task 4.2.)
void main() {
  late FakeAccountRepository account;

  Future<void> openHome(
    WidgetTester tester,
    FakeStatementRepository statement,
  ) async {
    // Tall enough for the Home's latest movements to be built at once.
    tester.view.physicalSize = const Size(1080, 3600);
    addTearDown(tester.view.reset);
    account = FakeAccountRepository();
    await pumpApp(
      tester,
      store: FakeTokenStore(tokens),
      account: account,
      statement: statement,
    );
    await unlockWithPin(tester);
    await showBalance(tester);
  }

  testWidgets('reads the balance again when the app comes back', (
    tester,
  ) async {
    final statement = statementOf(['funding']);
    await openHome(tester, statement.repository);
    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);

    account.balanceCents = 1010000;
    statement.arrive(['received', 'funding']);
    goToBackgroundAndBack(tester);
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel(r'R$ 10.100,00'), findsOneWidget);
  });

  testWidgets('reads it again when the customer pulls the Home down', (
    tester,
  ) async {
    final statement = statementOf(['funding']);
    await openHome(tester, statement.repository);

    account.balanceCents = 1010000;
    statement.arrive(['received', 'funding']);
    await tester.fling(
      find.byType(Scrollable).first,
      const Offset(0, 400),
      1000,
    );
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel(r'R$ 10.100,00'), findsOneWidget);
  });

  // Found on a device (week 8 plan, V1): offline, a pull replaced the balance
  // and the movements with error blocks, the last one behind the bar. What is
  // on screen stays, and the failure comes as a toast on top.
  testWidgets('keeps what it shows when a refresh fails, saying so on top', (
    tester,
  ) async {
    var offline = false;
    final statement = FakeStatementRepository({
      null: () async {
        if (offline) throw const ApiUnreachable();
        return (items: [movement('received')], nextCursor: null);
      },
    });
    await openHome(tester, statement);

    offline = true;
    account.answer = () async => throw const ApiUnreachable();
    await tester.fling(
      find.byType(Scrollable).first,
      const Offset(0, 400),
      1000,
    );
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel(r'R$ 10.000,00'), findsOneWidget);
    expect(find.byType(ErrorState), findsNothing);
    final toast = find.byType(NbToast);
    expect(toast, findsOneWidget);
    expect(
      find.descendant(
        of: toast,
        matching: find.text('Sem conexão. Tente de novo.'),
      ),
      findsOneWidget,
    );
    expect(
      tester.getRect(toast).top,
      lessThan(
        tester.view.physicalSize.height / tester.view.devicePixelRatio / 4,
      ),
    );
  });
}
