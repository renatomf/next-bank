import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/schedule_detail/schedule_detail_controller.dart';
import 'package:next_bank/features/pix/presentation/schedules/schedules_controller.dart';

import '../../../../support/fake_pix_schedule_repository.dart';

(ProviderContainer, FakePixScheduleRepository) setUpDetail() {
  final repository = FakePixScheduleRepository();
  final container = ProviderContainer(
    overrides: [pixScheduleRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  container
    ..listen(pixScheduleProvider('schedule-1'), (_, _) {})
    ..listen(cancelScheduleControllerProvider('schedule-1'), (_, _) {})
    ..listen(schedulesProvider, (_, _) {});
  return (container, repository);
}

CancelScheduleController cancelOf(ProviderContainer container) =>
    container.read(cancelScheduleControllerProvider('schedule-1').notifier);

// A schedule's detail and its cancel (v1.2.0 plan, task 7; S6): read as the
// server has it, cancelled once, and the list read again after.
void main() {
  test('reads the schedule as the server has it', () async {
    final (container, repository) = setUpDetail();

    final schedule = await container.read(
      pixScheduleProvider('schedule-1').future,
    );

    expect(schedule.id, 'schedule-1');
    expect(repository.callsOf('fetch').single.scheduleId, 'schedule-1');
  });

  test('cancels, and reads the schedule and the list again', () async {
    final (container, repository) = setUpDetail();
    await container.read(pixScheduleProvider('schedule-1').future);
    await container.read(schedulesProvider.future);
    repository.fetchAnswer = () async =>
        pixSchedule(status: PixScheduleStatus.cancelled);

    final cancelled = await cancelOf(container).cancel();

    expect(cancelled, isTrue);
    expect(repository.callsOf('cancel').single.scheduleId, 'schedule-1');
    final again = await container.read(
      pixScheduleProvider('schedule-1').future,
    );
    expect(again.status, PixScheduleStatus.cancelled);
    expect(repository.callsOf('list'), hasLength(2));
  });

  test('cancels once while a cancel runs', () async {
    final (container, repository) = setUpDetail();
    final answer = Completer<PixSchedule>();
    repository.cancelAnswer = () => answer.future;

    final first = cancelOf(container).cancel();
    expect(
      container.read(cancelScheduleControllerProvider('schedule-1')).cancelling,
      isTrue,
    );
    final second = cancelOf(container).cancel();
    answer.complete(pixSchedule(status: PixScheduleStatus.cancelled));
    await Future.wait<bool>([first, second]);

    expect(repository.callsOf('cancel'), hasLength(1));
  });

  test("says the catalog's words when it cannot cancel", () async {
    final (container, repository) = setUpDetail();
    repository.cancelAnswer = () async =>
        throw const ApiRejected(ApiErrorCode.scheduleNotActive);

    final cancelled = await cancelOf(container).cancel();

    expect(cancelled, isFalse);
    expect(
      container.read(cancelScheduleControllerProvider('schedule-1')).error,
      'Este agendamento já terminou.',
    );
  });
}
