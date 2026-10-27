import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_money.dart';
import 'package:next_bank/features/pix/data/api_pix_key.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_schedule_repository.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:nextbank_api/nextbank_api.dart' as api;

/// [PixScheduleRepository] over the generated API client (ADR 0008). A
/// status or a frequency a later API adds is read as unknown; what the
/// server never sends, such as a non-positive amount, a day that does not
/// exist or a next date that does not fit the status, is refused here
/// (MASVS, code).
class HttpPixScheduleRepository implements PixScheduleRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final api.DefaultApi _api;

  @override
  Future<PixSchedule> create({
    required PixKeyRef key,
    required int amountCents,
    required String? description,
    required CalendarDay firstDate,
    required int times,
    required String pin,
    required String idempotencyKey,
  }) async => _summaryOf(
    await _call(
      () => _api.createPixSchedule(
        idempotencyKey: idempotencyKey,
        createPixScheduleRequestInput: api.CreatePixScheduleRequestInput(
          key: pixKeyRequestOf(key),
          amount: api.MoneyInput(
            amount: amountCents,
            currency: api.MoneyInputCurrencyEnum.BRL,
          ),
          description: description,
          firstDate: firstDate.iso,
          recurrence: times == 1
              ? api.ScheduleRecurrenceRequestInput(
                  frequency:
                      api.ScheduleRecurrenceRequestInputFrequencyEnum.ONCE,
                )
              : api.ScheduleRecurrenceRequestInput(
                  frequency:
                      api.ScheduleRecurrenceRequestInputFrequencyEnum.MONTHLY,
                  times: times,
                ),
          pin: pin,
        ),
      ),
    ),
  );

  @override
  Future<PixSchedulePage> list({String? cursor}) async {
    final page = await _call(() => _api.listPixSchedules(cursor: cursor));
    return (
      items: page.items.map(_summaryOf).toList(),
      nextCursor: page.nextCursor,
    );
  }

  @override
  Future<PixSchedule> fetch(String scheduleId) async {
    final found = await _call(
      () => _api.getPixSchedule(scheduleId: scheduleId),
    );
    return _scheduleOf(
      id: found.id,
      status: found.status.value,
      amount: found.amount,
      description: found.description,
      payee: found.payee,
      firstDate: found.firstDate,
      recurrence: found.recurrence,
      nextOccurrenceDate: found.nextOccurrenceDate,
      lastOccurrenceDate: found.lastOccurrenceDate,
      createdAt: found.createdAt,
      occurrences: found.occurrences.map(_occurrenceOf).toList(),
    );
  }

  @override
  Future<PixSchedule> cancel(String scheduleId) async => _summaryOf(
    await _call(() => _api.cancelPixSchedule(scheduleId: scheduleId)),
  );

  Future<T> _call<T>(Future<Response<T>> Function() request) async {
    final T? data;
    try {
      data = (await request()).data;
    } on DioException catch (error) {
      throw apiFailureOf(error);
    }
    if (data == null) throw const ApiUnexpected();
    return data;
  }

  PixSchedule _summaryOf(api.PixSchedule schedule) => _scheduleOf(
    id: schedule.id,
    status: schedule.status.value,
    amount: schedule.amount,
    description: schedule.description,
    payee: schedule.payee,
    firstDate: schedule.firstDate,
    recurrence: schedule.recurrence,
    nextOccurrenceDate: schedule.nextOccurrenceDate,
    lastOccurrenceDate: schedule.lastOccurrenceDate,
    createdAt: schedule.createdAt,
    occurrences: const [],
  );

  /// One reading for a schedule and its detail, which the client generates
  /// as two types with the same fields; [status] is the wire value.
  PixSchedule _scheduleOf({
    required String id,
    required String status,
    required api.Money amount,
    required String? description,
    required api.PixSchedulePayee payee,
    required String firstDate,
    required api.ScheduleRecurrence recurrence,
    required String? nextOccurrenceDate,
    required String lastOccurrenceDate,
    required DateTime createdAt,
    required List<ScheduleOccurrence> occurrences,
  }) {
    final scheduleStatus = switch (status) {
      'ACTIVE' => PixScheduleStatus.active,
      'FINISHED' => PixScheduleStatus.finished,
      'CANCELLED' => PixScheduleStatus.cancelled,
      // A status a later API adds (A4): shown as it is, without actions.
      _ => PixScheduleStatus.unknown,
    };
    final next = nextOccurrenceDate == null ? null : _dayOf(nextOccurrenceDate);
    // Only an active schedule has a next occurrence.
    if (scheduleStatus != PixScheduleStatus.unknown &&
        (scheduleStatus == PixScheduleStatus.active) != (next != null)) {
      throw const ApiUnexpected();
    }
    final cents = reaisCentsOf(amount);
    if (cents <= 0 || recurrence.times < 1) throw const ApiUnexpected();
    return PixSchedule(
      id: id,
      status: scheduleStatus,
      amountCents: cents,
      description: description,
      payee: PixPayee(
        name: payee.name,
        documentMasked: payee.documentMasked,
        keyType: switch (payee.keyType) {
          api.PixSchedulePayeeKeyTypeEnum.CPF => PixKeyType.cpf,
          api.PixSchedulePayeeKeyTypeEnum.EMAIL => PixKeyType.email,
          api.PixSchedulePayeeKeyTypeEnum.PHONE => PixKeyType.phone,
          api.PixSchedulePayeeKeyTypeEnum.RANDOM => PixKeyType.random,
          api.PixSchedulePayeeKeyTypeEnum.unknownDefaultOpenApi =>
            throw const ApiUnexpected(),
        },
        keyMasked: payee.keyMasked,
        bankName: payee.bank?.name,
      ),
      firstDate: _dayOf(firstDate),
      frequency: switch (recurrence.frequency) {
        api.ScheduleRecurrenceFrequencyEnum.ONCE => ScheduleFrequency.once,
        api.ScheduleRecurrenceFrequencyEnum.MONTHLY =>
          ScheduleFrequency.monthly,
        api.ScheduleRecurrenceFrequencyEnum.unknownDefaultOpenApi =>
          ScheduleFrequency.other,
      },
      times: recurrence.times,
      nextOccurrenceDate: next,
      lastOccurrenceDate: _dayOf(lastOccurrenceDate),
      createdAt: createdAt,
      occurrences: occurrences,
    );
  }

  ScheduleOccurrence _occurrenceOf(api.PixScheduleOccurrence occurrence) {
    final status = switch (occurrence.status) {
      api.PixScheduleOccurrenceStatusEnum.AWAITING_AUTH =>
        PixStatus.awaitingAuth,
      api.PixScheduleOccurrenceStatusEnum.PROCESSING => PixStatus.processing,
      api.PixScheduleOccurrenceStatusEnum.COMPLETED => PixStatus.completed,
      api.PixScheduleOccurrenceStatusEnum.FAILED => PixStatus.failed,
      api.PixScheduleOccurrenceStatusEnum.CANCELLED => PixStatus.cancelled,
      api.PixScheduleOccurrenceStatusEnum.unknownDefaultOpenApi =>
        throw const ApiUnexpected(),
    };
    final reason = switch (occurrence.failureReason) {
      null => null,
      api.PixScheduleOccurrenceFailureReasonEnum.INSUFFICIENT_FUNDS =>
        PixFailureReason.insufficientFunds,
      api.PixScheduleOccurrenceFailureReasonEnum.LIMIT_EXCEEDED =>
        PixFailureReason.limitExceeded,
      api.PixScheduleOccurrenceFailureReasonEnum.PAYEE_UNAVAILABLE =>
        PixFailureReason.payeeUnavailable,
      api.PixScheduleOccurrenceFailureReasonEnum.ACCOUNT_BLOCKED =>
        PixFailureReason.accountBlocked,
      api.PixScheduleOccurrenceFailureReasonEnum.PAYEE_BANK_REJECTED =>
        PixFailureReason.payeeBankRejected,
      api.PixScheduleOccurrenceFailureReasonEnum.unknownDefaultOpenApi =>
        PixFailureReason.unknown,
    };
    // A failed occurrence always says why, and only a failed one does.
    if ((status == PixStatus.failed) != (reason != null)) {
      throw const ApiUnexpected();
    }
    return ScheduleOccurrence(
      sequence: occurrence.sequence,
      date: _dayOf(occurrence.date),
      transferId: occurrence.transferId,
      status: status,
      failureReason: reason,
    );
  }

  CalendarDay _dayOf(String text) {
    try {
      return CalendarDay.parse(text);
    } on FormatException {
      throw const ApiUnexpected();
    }
  }
}
