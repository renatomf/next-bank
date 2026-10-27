import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/new_schedule/new_schedule_screen.dart';
import 'package:next_bank/features/pix/presentation/receipt/receipt_screen.dart';
import 'package:next_bank/features/pix/presentation/schedule_detail/schedule_detail_screen.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_screen.dart';

import '../support/fake_pix_repository.dart';
import '../support/fake_pix_schedule_repository.dart';
import '../support/fake_token_store.dart';
import '../support/pump_app.dart';

// A valid CPF made up for the tests.
const _cpf = '52998224725';

/// The list that scrolls the screen [type].
Finder listOf(Type type) => find
    .descendant(of: find.byType(type), matching: find.byType(Scrollable))
    .first;

Future<void> openHome(
  WidgetTester tester, {
  FakePixRepository? pix,
  FakePixScheduleRepository? schedules,
}) async {
  await pumpApp(
    tester,
    store: FakeTokenStore(tokens),
    pix: pix,
    schedules: schedules,
  );
  await unlockWithPin(tester);
}

Future<void> openSchedules(WidgetTester tester) async {
  await tester.tap(find.bySemanticsLabel('Agendamentos'));
  await tester.pumpAndSettle();
}

// The scheduled Pix through the whole app (v1.2.0 plan, task 7; D11):
// "Agendamentos" on the Home, the list, the detail with its occurrences and
// the cancel, and "Agendar" from the Pix screen with the PIN.
void main() {
  testWidgets('lists the schedules and opens one with its occurrences', (
    tester,
  ) async {
    final schedules = FakePixScheduleRepository()
      ..fetchAnswer = () async => pixSchedule(
        occurrences: const [
          ScheduleOccurrence(
            sequence: 1,
            date: CalendarDay(2026, 11, 5),
            transferId: 'pix-1',
            status: PixStatus.failed,
            failureReason: PixFailureReason.insufficientFunds,
          ),
        ],
      );
    await openHome(tester, schedules: schedules);

    await openSchedules(tester);
    expect(find.text('Mariana Costa'), findsOneWidget);
    expect(
      find.text('Todo mês, 3 vezes · próximo em 05/11/2026'),
      findsOneWidget,
    );

    await tester.tap(find.text('Mariana Costa'));
    await tester.pumpAndSettle();

    expect(find.byType(ScheduleDetailScreen), findsOneWidget);
    expect(find.text('Todo mês, 3 vezes'), findsOneWidget);
    expect(find.text('Não pago: saldo insuficiente'), findsOneWidget);
    expect(schedules.callsOf('fetch').single.scheduleId, 'schedule-1');
  });

  testWidgets("opens an occurrence's receipt", (tester) async {
    final pix = FakePixRepository()
      ..fetchAnswer = () async =>
          pixTransfer(status: PixStatus.completed, endToEndId: 'E1');
    final schedules = FakePixScheduleRepository()
      ..fetchAnswer = () async => pixSchedule(
        occurrences: const [
          ScheduleOccurrence(
            sequence: 1,
            date: CalendarDay(2026, 11, 5),
            transferId: 'pix-1',
            status: PixStatus.completed,
            failureReason: null,
          ),
        ],
      );
    await openHome(tester, pix: pix, schedules: schedules);
    await openSchedules(tester);
    await tester.tap(find.text('Mariana Costa'));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel(RegExp('Pagamento de 05/11/2026')));
    await tester.pumpAndSettle();

    expect(find.byType(ReceiptScreen), findsOneWidget);
  });

  testWidgets('cancels a schedule after asking', (tester) async {
    final schedules = FakePixScheduleRepository();
    await openHome(tester, schedules: schedules);
    await openSchedules(tester);
    await tester.tap(find.text('Mariana Costa'));
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Cancelar agendamento'),
      200,
      scrollable: listOf(ScheduleDetailScreen),
    );
    await tester.tap(find.text('Cancelar agendamento'));
    await tester.pumpAndSettle();
    expect(find.text('Cancelar agendamento?'), findsOneWidget);
    schedules.fetchAnswer = () async =>
        pixSchedule(status: PixScheduleStatus.cancelled);
    await tester.tap(find.text('Cancelar agendamento').last);
    await tester.pumpAndSettle();

    expect(schedules.callsOf('cancel').single.scheduleId, 'schedule-1');
    expect(find.text('Cancelado'), findsOneWidget);
    expect(find.text('Cancelar agendamento'), findsNothing);
  });

  testWidgets('says how to schedule when there is nothing yet', (tester) async {
    final schedules = FakePixScheduleRepository()
      ..listAnswer = (_) async => (items: <PixSchedule>[], nextCursor: null);
    await openHome(tester, schedules: schedules);

    await openSchedules(tester);

    expect(find.text('Nenhum Pix agendado'), findsOneWidget);
    await tester.tap(find.text('Agendar um Pix'));
    await tester.pumpAndSettle();
    expect(find.byType(SendPixScreen), findsOneWidget);
  });

  testWidgets('schedules the Pix of the Pix screen with the PIN', (
    tester,
  ) async {
    final schedules = FakePixScheduleRepository();
    await openHome(tester, schedules: schedules);
    await tester.tap(find.bySemanticsLabel('Área Pix'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byWidgetPredicate(
        (w) => w is TextField && w.decoration?.labelText == 'Valor do Pix',
      ),
      '35000',
    );
    final key = find.descendant(
      of: find.widgetWithText(NbTextField, 'Chave Pix'),
      matching: find.byType(TextField),
    );
    await tester.enterText(key, _cpf);
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();

    await tester.scrollUntilVisible(
      find.text('Agendar'),
      200,
      scrollable: listOf(SendPixScreen),
    );
    await tester.tap(find.text('Agendar'));
    await tester.pumpAndSettle();
    expect(find.byType(NewScheduleScreen), findsOneWidget);
    expect(find.text('Mariana Costa'), findsOneWidget);

    await tester.tap(find.byType(FilterPill).first);
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.byType(PinField),
      200,
      scrollable: listOf(NewScheduleScreen),
    );
    await tester.enterText(find.byType(PinField), '2580');
    await tester.pumpAndSettle();

    final call = schedules.callsOf('create').single;
    expect(call.key, (type: PixKeyType.cpf, value: _cpf));
    expect(call.amountCents, 35000);
    expect(call.times, 1);
    expect(call.pin, '2580');
    expect(find.byType(ScheduleDetailScreen), findsOneWidget);
  });
}
