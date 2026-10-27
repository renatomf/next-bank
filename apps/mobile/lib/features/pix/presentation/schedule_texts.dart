import 'package:design_system/design_system.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

/// "05/11/2026": a day as the customer reads it.
String dayText(CalendarDay day) =>
    '${day.day.toString().padLeft(2, '0')}/'
    '${day.month.toString().padLeft(2, '0')}/${day.year}';

/// How often it runs, e.g. "Todo mês, 3 vezes" or "Uma vez".
String recurrenceText(ScheduleFrequency frequency, int times) =>
    switch (frequency) {
      ScheduleFrequency.once => 'Uma vez',
      ScheduleFrequency.monthly => 'Todo mês, $times vezes',
      ScheduleFrequency.other => '$times vezes',
    };

/// Where a schedule is, as a badge says it; null while it is active, when
/// its next date says it instead.
(StatusTone, String)? scheduleBadge(PixScheduleStatus status) =>
    switch (status) {
      PixScheduleStatus.active => null,
      PixScheduleStatus.finished => (StatusTone.success, 'Concluído'),
      PixScheduleStatus.cancelled => (StatusTone.danger, 'Cancelado'),
      PixScheduleStatus.unknown => (StatusTone.pending, 'Indisponível'),
    };

/// The line under a schedule in the list: when it runs next, or that it
/// ended.
String scheduleCaption(PixSchedule schedule) {
  final next = schedule.nextOccurrenceDate;
  final recurrence = recurrenceText(schedule.frequency, schedule.times);
  return next == null
      ? '$recurrence · até ${dayText(schedule.lastOccurrenceDate)}'
      : '$recurrence · próximo em ${dayText(next)}';
}

/// What an occurrence's Pix became, as its row says it.
(StatusTone, String) occurrenceBadge(ScheduleOccurrence occurrence) =>
    switch (occurrence.status) {
      PixStatus.completed => (StatusTone.success, 'Pago'),
      PixStatus.failed => (StatusTone.danger, _failureText(occurrence)),
      PixStatus.awaitingAuth ||
      PixStatus.processing => (StatusTone.pending, 'Em processamento'),
      PixStatus.cancelled => (StatusTone.danger, 'Cancelado'),
    };

String _failureText(ScheduleOccurrence occurrence) =>
    switch (occurrence.failureReason) {
      PixFailureReason.insufficientFunds => 'Não pago: saldo insuficiente',
      PixFailureReason.limitExceeded => 'Não pago: acima do limite',
      PixFailureReason.payeeUnavailable =>
        'Não pago: conta de destino indisponível',
      PixFailureReason.accountBlocked => 'Não pago: conta bloqueada',
      PixFailureReason.payeeBankRejected => 'Não pago: recusado pelo banco',
      PixFailureReason.unknown || null => 'Não pago',
    };
