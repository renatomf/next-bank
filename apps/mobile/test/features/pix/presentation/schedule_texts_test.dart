import 'package:design_system/design_system.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/schedule_texts.dart';

import '../../../support/fake_pix_schedule_repository.dart';

// How the scheduled Pix read (v1.2.0 plan, task 7): days as dd/mm/aaaa,
// the recurrence, when it runs next or that it ended, and each outcome.
void main() {
  test('writes a day as the customer reads it', () {
    expect(dayText(const CalendarDay(2026, 1, 5)), '05/01/2026');
  });

  test('says how often it runs', () {
    expect(recurrenceText(ScheduleFrequency.once, 1), 'Uma vez');
    expect(recurrenceText(ScheduleFrequency.monthly, 3), 'Todo mês, 3 vezes');
    expect(recurrenceText(ScheduleFrequency.other, 4), '4 vezes');
  });

  test('says when it runs next, or until when it ran', () {
    expect(
      scheduleCaption(pixSchedule()),
      'Todo mês, 3 vezes · próximo em 05/11/2026',
    );
    expect(
      scheduleCaption(pixSchedule(status: PixScheduleStatus.cancelled)),
      'Todo mês, 3 vezes · até 05/01/2027',
    );
  });

  test('badges an ended schedule, never an active one', () {
    expect(scheduleBadge(PixScheduleStatus.active), isNull);
    expect(scheduleBadge(PixScheduleStatus.finished), (
      StatusTone.success,
      'Concluído',
    ));
    expect(scheduleBadge(PixScheduleStatus.cancelled), (
      StatusTone.danger,
      'Cancelado',
    ));
  });

  test("says what each occurrence's Pix became, with the reason it failed", () {
    ScheduleOccurrence occurrence(PixStatus status, [PixFailureReason? r]) =>
        ScheduleOccurrence(
          sequence: 1,
          date: const CalendarDay(2026, 11, 5),
          transferId: 'pix-1',
          status: status,
          failureReason: r,
        );

    expect(occurrenceBadge(occurrence(PixStatus.completed)).$2, 'Pago');
    expect(
      occurrenceBadge(occurrence(PixStatus.processing)).$2,
      'Em processamento',
    );
    expect(
      occurrenceBadge(
        occurrence(PixStatus.failed, PixFailureReason.limitExceeded),
      ).$2,
      'Não pago: acima do limite',
    );
  });
}
