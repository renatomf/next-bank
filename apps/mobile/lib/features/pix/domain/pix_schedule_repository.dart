import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

/// Schedules Pix through the API (v1.2.0 plan, task 7). Failures are
/// reported as `ApiFailure` with the catalog code. Scheduling takes the
/// idempotency key of its attempt, so a repeated attempt never becomes a
/// second schedule (ADR 0007; MOB-07).
abstract interface class PixScheduleRepository {
  /// Schedules [amountCents] to the [key] from [firstDate], [times] times a
  /// month (1: once), authorized by the [pin], checked on the server.
  Future<PixSchedule> create({
    required PixKeyRef key,
    required int amountCents,
    required String? description,
    required CalendarDay firstDate,
    required int times,
    required String pin,
    required String idempotencyKey,
  });

  /// The customer's schedules, newest first, from [cursor] on.
  Future<PixSchedulePage> list({String? cursor});

  /// The schedule [scheduleId] with its occurrences, as the server has it.
  Future<PixSchedule> fetch(String scheduleId);

  /// Cancels the schedule [scheduleId]; cancelling again answers the same.
  Future<PixSchedule> cancel(String scheduleId);
}
