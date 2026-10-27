// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_schedule_occurrence.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixScheduleOccurrenceCWProxy {
  PixScheduleOccurrence sequence(int sequence);

  PixScheduleOccurrence date(DateTime date);

  PixScheduleOccurrence transferId(String transferId);

  PixScheduleOccurrence status(PixScheduleOccurrenceStatusEnum status);

  PixScheduleOccurrence failureReason(
    PixScheduleOccurrenceFailureReasonEnum? failureReason,
  );

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixScheduleOccurrence(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixScheduleOccurrence(...).copyWith(id: 12, name: "My name")
  /// ```
  PixScheduleOccurrence call({
    int sequence,
    DateTime date,
    String transferId,
    PixScheduleOccurrenceStatusEnum status,
    PixScheduleOccurrenceFailureReasonEnum? failureReason,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixScheduleOccurrence.copyWith(...)` or call `instanceOfPixScheduleOccurrence.copyWith.fieldName(value)` for a single field.
class _$PixScheduleOccurrenceCWProxyImpl
    implements _$PixScheduleOccurrenceCWProxy {
  const _$PixScheduleOccurrenceCWProxyImpl(this._value);

  final PixScheduleOccurrence _value;

  @override
  PixScheduleOccurrence sequence(int sequence) => call(sequence: sequence);

  @override
  PixScheduleOccurrence date(DateTime date) => call(date: date);

  @override
  PixScheduleOccurrence transferId(String transferId) =>
      call(transferId: transferId);

  @override
  PixScheduleOccurrence status(PixScheduleOccurrenceStatusEnum status) =>
      call(status: status);

  @override
  PixScheduleOccurrence failureReason(
    PixScheduleOccurrenceFailureReasonEnum? failureReason,
  ) => call(failureReason: failureReason);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixScheduleOccurrence(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixScheduleOccurrence(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixScheduleOccurrence call({
    Object? sequence = const $CopyWithPlaceholder(),
    Object? date = const $CopyWithPlaceholder(),
    Object? transferId = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? failureReason = const $CopyWithPlaceholder(),
  }) {
    return PixScheduleOccurrence(
      sequence: sequence == const $CopyWithPlaceholder() || sequence == null
          ? _value.sequence
          // ignore: cast_nullable_to_non_nullable
          : sequence as int,
      date: date == const $CopyWithPlaceholder() || date == null
          ? _value.date
          // ignore: cast_nullable_to_non_nullable
          : date as DateTime,
      transferId:
          transferId == const $CopyWithPlaceholder() || transferId == null
          ? _value.transferId
          // ignore: cast_nullable_to_non_nullable
          : transferId as String,
      status: status == const $CopyWithPlaceholder() || status == null
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as PixScheduleOccurrenceStatusEnum,
      failureReason: failureReason == const $CopyWithPlaceholder()
          ? _value.failureReason
          // ignore: cast_nullable_to_non_nullable
          : failureReason as PixScheduleOccurrenceFailureReasonEnum?,
    );
  }
}

extension $PixScheduleOccurrenceCopyWith on PixScheduleOccurrence {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixScheduleOccurrence.copyWith(...)` or `instanceOfPixScheduleOccurrence.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixScheduleOccurrenceCWProxy get copyWith =>
      _$PixScheduleOccurrenceCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixScheduleOccurrence _$PixScheduleOccurrenceFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('PixScheduleOccurrence', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'sequence',
      'date',
      'transferId',
      'status',
      'failureReason',
    ],
  );
  final val = PixScheduleOccurrence(
    sequence: $checkedConvert('sequence', (v) => (v as num).toInt()),
    date: $checkedConvert('date', (v) => DateTime.parse(v as String)),
    transferId: $checkedConvert('transferId', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$PixScheduleOccurrenceStatusEnumEnumMap,
        v,
        unknownValue: PixScheduleOccurrenceStatusEnum.unknownDefaultOpenApi,
      ),
    ),
    failureReason: $checkedConvert(
      'failureReason',
      (v) => $enumDecodeNullable(
        _$PixScheduleOccurrenceFailureReasonEnumEnumMap,
        v,
        unknownValue:
            PixScheduleOccurrenceFailureReasonEnum.unknownDefaultOpenApi,
      ),
    ),
  );
  return val;
});

Map<String, dynamic> _$PixScheduleOccurrenceToJson(
  PixScheduleOccurrence instance,
) => <String, dynamic>{
  'sequence': instance.sequence,
  'date': instance.date.toIso8601String(),
  'transferId': instance.transferId,
  'status': _$PixScheduleOccurrenceStatusEnumEnumMap[instance.status]!,
  'failureReason':
      _$PixScheduleOccurrenceFailureReasonEnumEnumMap[instance.failureReason],
};

const _$PixScheduleOccurrenceStatusEnumEnumMap = {
  PixScheduleOccurrenceStatusEnum.AWAITING_AUTH: 'AWAITING_AUTH',
  PixScheduleOccurrenceStatusEnum.PROCESSING: 'PROCESSING',
  PixScheduleOccurrenceStatusEnum.COMPLETED: 'COMPLETED',
  PixScheduleOccurrenceStatusEnum.FAILED: 'FAILED',
  PixScheduleOccurrenceStatusEnum.CANCELLED: 'CANCELLED',
  PixScheduleOccurrenceStatusEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};

const _$PixScheduleOccurrenceFailureReasonEnumEnumMap = {
  PixScheduleOccurrenceFailureReasonEnum.INSUFFICIENT_FUNDS:
      'INSUFFICIENT_FUNDS',
  PixScheduleOccurrenceFailureReasonEnum.LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  PixScheduleOccurrenceFailureReasonEnum.PAYEE_UNAVAILABLE: 'PAYEE_UNAVAILABLE',
  PixScheduleOccurrenceFailureReasonEnum.ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',
  PixScheduleOccurrenceFailureReasonEnum.PAYEE_BANK_REJECTED:
      'PAYEE_BANK_REJECTED',
  PixScheduleOccurrenceFailureReasonEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
