import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/new_schedule/new_schedule_controller.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';

import '../../../../support/fake_greeting_name_store.dart';
import '../../../../support/fake_pix_repository.dart' show sequentialKeys;
import '../../../../support/fake_pix_schedule_repository.dart';
import '../../../../support/fake_token_store.dart';

const ScheduleDraft _draft = (
  key: (type: PixKeyType.cpf, value: '12345678909'),
  payeeName: 'Mariana Costa',
  payeeDetail: 'CPF ***.456.789-** · next bank',
  amountCents: 15000,
  description: 'Aluguel',
);

const _unknownOutcome =
    'Não conseguimos confirmar o agendamento. Tente de novo: ele não será '
    'feito duas vezes.';

(ProviderContainer, FakePixScheduleRepository) setUpSchedule() {
  final repository = FakePixScheduleRepository();
  final container = ProviderContainer(
    overrides: [
      pixScheduleRepositoryProvider.overrideWithValue(repository),
      tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
      greetingNameStoreProvider.overrideWithValue(FakeGreetingNameStore()),
      idempotencyKeysProvider.overrideWithValue(sequentialKeys()),
      nowProvider.overrideWithValue(() => DateTime(2026, 10, 27, 9)),
    ],
  );
  addTearDown(container.dispose);
  container.listen(newScheduleControllerProvider(_draft), (_, _) {});
  return (container, repository);
}

NewScheduleController controllerOf(ProviderContainer container) =>
    container.read(newScheduleControllerProvider(_draft).notifier);

NewScheduleState stateOf(ProviderContainer container) =>
    container.read(newScheduleControllerProvider(_draft));

// Scheduling a Pix from the Pix screen (v1.2.0 plan, task 7; D11): a date
// from tomorrow to a year ahead (S7), once or monthly 2 to 24 times (S2),
// then the PIN, checked on the server (D10); one key per attempt and the
// same key for a lost answer (MOB-07), never the PIN in the state (MOB-02).
void main() {
  test('starts without a date, once, with tomorrow to a year ahead', () {
    final (container, _) = setUpSchedule();

    final state = stateOf(container);
    expect(state.firstDate, isNull);
    expect(state.monthly, isFalse);
    expect(state.canConfirm, isFalse);
    expect(state.earliest, const CalendarDay(2026, 10, 28));
    expect(state.latest, const CalendarDay(2027, 10, 27));
  });

  test('ends on the first date once, or on the last month', () {
    final (container, _) = setUpSchedule();
    final controller = controllerOf(container)
      ..pickDate(const CalendarDay(2027, 1, 31));

    expect(stateOf(container).lastDate, const CalendarDay(2027, 1, 31));

    controller
      ..setMonthly(monthly: true)
      ..setTimes(4);

    expect(stateOf(container).times, 4);
    expect(stateOf(container).lastDate, const CalendarDay(2027, 4, 30));
  });

  test('keeps the times from 2 to 24', () {
    final (container, _) = setUpSchedule();
    final controller = controllerOf(container)
      ..setMonthly(monthly: true)
      ..setTimes(1);
    expect(stateOf(container).times, 2);
    controller.setTimes(30);
    expect(stateOf(container).times, 24);
  });

  test('ignores a date outside tomorrow to a year ahead', () {
    final (container, _) = setUpSchedule();

    controllerOf(container)
      ..pickDate(const CalendarDay(2026, 10, 27))
      ..pickDate(const CalendarDay(2027, 10, 28));

    expect(stateOf(container).firstDate, isNull);
  });

  test(
    'schedules with the draft, the date, the times, the PIN and a key',
    () async {
      final (container, repository) = setUpSchedule();
      controllerOf(container)
        ..pickDate(const CalendarDay(2026, 11, 5))
        ..setMonthly(monthly: true)
        ..setTimes(3);

      final done = await controllerOf(container).confirm('2580');

      final call = repository.callsOf('create').single;
      expect(call.key, _draft.key);
      expect(call.amountCents, 15000);
      expect(call.description, 'Aluguel');
      expect(call.firstDate, const CalendarDay(2026, 11, 5));
      expect(call.times, 3);
      expect(call.pin, '2580');
      expect(call.idempotencyKey, 'key-1');
      expect(done?.id, 'schedule-1');
    },
  );

  test('schedules once as one time', () async {
    final (container, repository) = setUpSchedule();
    controllerOf(container)
      ..pickDate(const CalendarDay(2026, 11, 5))
      ..setMonthly(monthly: true)
      ..setMonthly(monthly: false);

    await controllerOf(container).confirm('2580');

    expect(repository.callsOf('create').single.times, 1);
  });

  test('schedules nothing without a date', () async {
    final (container, repository) = setUpSchedule();

    expect(await controllerOf(container).confirm('2580'), isNull);
    expect(repository.callsOf('create'), isEmpty);
  });

  test('schedules once while a scheduling runs', () async {
    final (container, repository) = setUpSchedule();
    final answer = Completer<PixSchedule>();
    repository.createAnswer = () => answer.future;
    controllerOf(container).pickDate(const CalendarDay(2026, 11, 5));

    final first = controllerOf(container).confirm('2580');
    expect(stateOf(container).verifying, isTrue);
    final second = controllerOf(container).confirm('2580');
    answer.complete(pixSchedule());
    await Future.wait<PixSchedule?>([first, second]);

    expect(repository.callsOf('create'), hasLength(1));
  });

  test(
    'says how many PIN attempts are left, and a new PIN goes with a new key',
    () async {
      final (container, repository) = setUpSchedule();
      repository.createAnswer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );
      controllerOf(container).pickDate(const CalendarDay(2026, 11, 5));

      await controllerOf(container).confirm('1111');
      expect(stateOf(container).error, 'PIN incorreto. Restam 4 tentativas.');

      repository.createAnswer = () async => pixSchedule();
      await controllerOf(container).confirm('2580');
      expect(repository.callsOf('create').map((call) => call.idempotencyKey), [
        'key-1',
        'key-2',
      ]);
    },
  );

  test('blocks the PIN once the server locks it', () async {
    final (container, repository) = setUpSchedule();
    repository.createAnswer = () async =>
        throw const ApiRejected(ApiErrorCode.pinLocked);
    controllerOf(container).pickDate(const CalendarDay(2026, 11, 5));

    await controllerOf(container).confirm('1111');

    expect(stateOf(container).blocked, isTrue);
    expect(await controllerOf(container).confirm('2580'), isNull);
    expect(repository.callsOf('create'), hasLength(1));
  });

  test("says the catalog's words for a date the server refuses", () async {
    final (container, repository) = setUpSchedule();
    repository.createAnswer = () async =>
        throw const ApiRejected(ApiErrorCode.scheduleInPast);
    controllerOf(container).pickDate(const CalendarDay(2026, 10, 28));

    await controllerOf(container).confirm('2580');

    expect(stateOf(container).error, 'Escolha uma data a partir de amanhã.');
  });

  // MOB-07: the server may have scheduled it; only the same attempt goes.
  group('with the answer lost', () {
    Future<ProviderContainer> lost() async {
      final (container, repository) = setUpSchedule();
      repository.createAnswer = () async => throw const ApiUnreachable();
      controllerOf(container)
        ..pickDate(const CalendarDay(2026, 11, 5))
        ..setMonthly(monthly: true)
        ..setTimes(6);
      await controllerOf(container).confirm('2580');
      return container;
    }

    test('offers only the same attempt again', () async {
      final container = await lost();

      final state = stateOf(container);
      expect(state.outcomeUnknown, isTrue);
      expect(state.error, _unknownOutcome);
      expect(await controllerOf(container).confirm('9999'), isNull);
      controllerOf(container).pickDate(const CalendarDay(2026, 12, 1));
      expect(stateOf(container).firstDate, const CalendarDay(2026, 11, 5));
    });

    test('repeats it with its PIN and key', () async {
      final (container, repository) = setUpSchedule();
      repository.createAnswer = () async => throw const ApiUnreachable();
      controllerOf(container).pickDate(const CalendarDay(2026, 11, 5));
      await controllerOf(container).confirm('2580');
      repository.createAnswer = () async => pixSchedule();

      final done = await controllerOf(container).retry();

      expect(done?.id, 'schedule-1');
      expect(
        repository.callsOf('create').map((c) => (c.idempotencyKey, c.pin)),
        [('key-1', '2580'), ('key-1', '2580')],
      );
      expect(stateOf(container).outcomeUnknown, isFalse);
    });

    // F-39: leaving and opening the same schedule again brings it back.
    test('brings the same attempt back when the screen opens again', () async {
      final (container, repository) = setUpSchedule();
      repository.createAnswer = () async => throw const ApiUnreachable();
      controllerOf(container)
        ..pickDate(const CalendarDay(2026, 11, 5))
        ..setMonthly(monthly: true)
        ..setTimes(6);
      await controllerOf(container).confirm('2580');

      container.invalidate(newScheduleControllerProvider(_draft));
      final state = stateOf(container);

      expect(state.outcomeUnknown, isTrue);
      expect(state.firstDate, const CalendarDay(2026, 11, 5));
      expect(state.times, 6);
      repository.createAnswer = () async => pixSchedule();
      await controllerOf(container).retry();
      expect(repository.callsOf('create').last.idempotencyKey, 'key-1');
    });
  });
}
