import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_schedule_repository.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

import 'fake_pix_repository.dart' show mariana;

/// A monthly Pix of R$ 150,00 to Mariana, 3 times from 05/11/2026; the
/// arguments change what matters.
PixSchedule pixSchedule({
  String id = 'schedule-1',
  PixScheduleStatus status = PixScheduleStatus.active,
  int times = 3,
  List<ScheduleOccurrence> occurrences = const [],
}) => PixSchedule(
  id: id,
  status: status,
  amountCents: 15000,
  description: 'Aluguel',
  payee: mariana,
  firstDate: const CalendarDay(2026, 11, 5),
  frequency: times == 1 ? ScheduleFrequency.once : ScheduleFrequency.monthly,
  times: times,
  nextOccurrenceDate: status == PixScheduleStatus.active
      ? const CalendarDay(2026, 11, 5)
      : null,
  lastOccurrenceDate: const CalendarDay(2026, 11, 5).monthly(times),
  createdAt: DateTime.utc(2026, 10, 27, 15),
  occurrences: occurrences,
);

/// A call the fake received.
typedef PixScheduleCall = ({
  String command,
  PixKeyRef? key,
  int? amountCents,
  String? description,
  CalendarDay? firstDate,
  int? times,
  String? pin,
  String? idempotencyKey,
  String? scheduleId,
  String? cursor,
});

/// Schedules without the API: records every call and answers with what the
/// test set, by default one active schedule.
class FakePixScheduleRepository implements PixScheduleRepository {
  /// What the next schedulings do.
  Future<PixSchedule> Function() createAnswer = () async => pixSchedule();

  /// What the next page reads do, by the cursor asked.
  Future<PixSchedulePage> Function(String? cursor) listAnswer = (_) async =>
      (items: [pixSchedule()], nextCursor: null);

  /// What the next reads of a schedule do.
  Future<PixSchedule> Function() fetchAnswer = () async => pixSchedule();

  /// What the next cancels do.
  Future<PixSchedule> Function() cancelAnswer = () async =>
      pixSchedule(status: PixScheduleStatus.cancelled);

  final List<PixScheduleCall> _calls = [];

  /// The calls of [command], in order.
  List<PixScheduleCall> callsOf(String command) =>
      _calls.where((call) => call.command == command).toList();

  @override
  Future<PixSchedule> create({
    required PixKeyRef key,
    required int amountCents,
    required String? description,
    required CalendarDay firstDate,
    required int times,
    required String pin,
    required String idempotencyKey,
  }) {
    _record(
      'create',
      key: key,
      amountCents: amountCents,
      description: description,
      firstDate: firstDate,
      times: times,
      pin: pin,
      idempotencyKey: idempotencyKey,
    );
    return createAnswer();
  }

  @override
  Future<PixSchedulePage> list({String? cursor}) {
    _record('list', cursor: cursor);
    return listAnswer(cursor);
  }

  @override
  Future<PixSchedule> fetch(String scheduleId) {
    _record('fetch', scheduleId: scheduleId);
    return fetchAnswer();
  }

  @override
  Future<PixSchedule> cancel(String scheduleId) {
    _record('cancel', scheduleId: scheduleId);
    return cancelAnswer();
  }

  void _record(
    String command, {
    PixKeyRef? key,
    int? amountCents,
    String? description,
    CalendarDay? firstDate,
    int? times,
    String? pin,
    String? idempotencyKey,
    String? scheduleId,
    String? cursor,
  }) => _calls.add((
    command: command,
    key: key,
    amountCents: amountCents,
    description: description,
    firstDate: firstDate,
    times: times,
    pin: pin,
    idempotencyKey: idempotencyKey,
    scheduleId: scheduleId,
    cursor: cursor,
  ));
}
