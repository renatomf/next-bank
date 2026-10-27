// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_schedule.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixScheduleCWProxy {
  PixSchedule id(String id);

  PixSchedule status(PixScheduleStatusEnum status);

  PixSchedule amount(Money amount);

  PixSchedule description(String? description);

  PixSchedule payee(PixSchedulePayee payee);

  PixSchedule firstDate(DateTime firstDate);

  PixSchedule recurrence(ScheduleRecurrence recurrence);

  PixSchedule nextOccurrenceDate(DateTime? nextOccurrenceDate);

  PixSchedule lastOccurrenceDate(DateTime lastOccurrenceDate);

  PixSchedule createdAt(DateTime createdAt);

  PixSchedule cancelledAt(DateTime? cancelledAt);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixSchedule(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixSchedule(...).copyWith(id: 12, name: "My name")
  /// ```
  PixSchedule call({
    String id,
    PixScheduleStatusEnum status,
    Money amount,
    String? description,
    PixSchedulePayee payee,
    DateTime firstDate,
    ScheduleRecurrence recurrence,
    DateTime? nextOccurrenceDate,
    DateTime lastOccurrenceDate,
    DateTime createdAt,
    DateTime? cancelledAt,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixSchedule.copyWith(...)` or call `instanceOfPixSchedule.copyWith.fieldName(value)` for a single field.
class _$PixScheduleCWProxyImpl implements _$PixScheduleCWProxy {
  const _$PixScheduleCWProxyImpl(this._value);

  final PixSchedule _value;

  @override
  PixSchedule id(String id) => call(id: id);

  @override
  PixSchedule status(PixScheduleStatusEnum status) => call(status: status);

  @override
  PixSchedule amount(Money amount) => call(amount: amount);

  @override
  PixSchedule description(String? description) =>
      call(description: description);

  @override
  PixSchedule payee(PixSchedulePayee payee) => call(payee: payee);

  @override
  PixSchedule firstDate(DateTime firstDate) => call(firstDate: firstDate);

  @override
  PixSchedule recurrence(ScheduleRecurrence recurrence) =>
      call(recurrence: recurrence);

  @override
  PixSchedule nextOccurrenceDate(DateTime? nextOccurrenceDate) =>
      call(nextOccurrenceDate: nextOccurrenceDate);

  @override
  PixSchedule lastOccurrenceDate(DateTime lastOccurrenceDate) =>
      call(lastOccurrenceDate: lastOccurrenceDate);

  @override
  PixSchedule createdAt(DateTime createdAt) => call(createdAt: createdAt);

  @override
  PixSchedule cancelledAt(DateTime? cancelledAt) =>
      call(cancelledAt: cancelledAt);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixSchedule(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixSchedule(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixSchedule call({
    Object? id = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? amount = const $CopyWithPlaceholder(),
    Object? description = const $CopyWithPlaceholder(),
    Object? payee = const $CopyWithPlaceholder(),
    Object? firstDate = const $CopyWithPlaceholder(),
    Object? recurrence = const $CopyWithPlaceholder(),
    Object? nextOccurrenceDate = const $CopyWithPlaceholder(),
    Object? lastOccurrenceDate = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? cancelledAt = const $CopyWithPlaceholder(),
  }) {
    return PixSchedule(
      id: id == const $CopyWithPlaceholder() || id == null
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      status: status == const $CopyWithPlaceholder() || status == null
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as PixScheduleStatusEnum,
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as Money,
      description: description == const $CopyWithPlaceholder()
          ? _value.description
          // ignore: cast_nullable_to_non_nullable
          : description as String?,
      payee: payee == const $CopyWithPlaceholder() || payee == null
          ? _value.payee
          // ignore: cast_nullable_to_non_nullable
          : payee as PixSchedulePayee,
      firstDate: firstDate == const $CopyWithPlaceholder() || firstDate == null
          ? _value.firstDate
          // ignore: cast_nullable_to_non_nullable
          : firstDate as DateTime,
      recurrence:
          recurrence == const $CopyWithPlaceholder() || recurrence == null
          ? _value.recurrence
          // ignore: cast_nullable_to_non_nullable
          : recurrence as ScheduleRecurrence,
      nextOccurrenceDate: nextOccurrenceDate == const $CopyWithPlaceholder()
          ? _value.nextOccurrenceDate
          // ignore: cast_nullable_to_non_nullable
          : nextOccurrenceDate as DateTime?,
      lastOccurrenceDate:
          lastOccurrenceDate == const $CopyWithPlaceholder() ||
              lastOccurrenceDate == null
          ? _value.lastOccurrenceDate
          // ignore: cast_nullable_to_non_nullable
          : lastOccurrenceDate as DateTime,
      createdAt: createdAt == const $CopyWithPlaceholder() || createdAt == null
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      cancelledAt: cancelledAt == const $CopyWithPlaceholder()
          ? _value.cancelledAt
          // ignore: cast_nullable_to_non_nullable
          : cancelledAt as DateTime?,
    );
  }
}

extension $PixScheduleCopyWith on PixSchedule {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixSchedule.copyWith(...)` or `instanceOfPixSchedule.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixScheduleCWProxy get copyWith => _$PixScheduleCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixSchedule _$PixScheduleFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('PixSchedule', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'status',
      'amount',
      'description',
      'payee',
      'firstDate',
      'recurrence',
      'nextOccurrenceDate',
      'lastOccurrenceDate',
      'createdAt',
      'cancelledAt',
    ],
  );
  final val = PixSchedule(
    id: $checkedConvert('id', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$PixScheduleStatusEnumEnumMap,
        v,
        unknownValue: PixScheduleStatusEnum.unknownDefaultOpenApi,
      ),
    ),
    amount: $checkedConvert(
      'amount',
      (v) => Money.fromJson(v as Map<String, dynamic>),
    ),
    description: $checkedConvert('description', (v) => v as String?),
    payee: $checkedConvert(
      'payee',
      (v) => PixSchedulePayee.fromJson(v as Map<String, dynamic>),
    ),
    firstDate: $checkedConvert('firstDate', (v) => DateTime.parse(v as String)),
    recurrence: $checkedConvert(
      'recurrence',
      (v) => ScheduleRecurrence.fromJson(v as Map<String, dynamic>),
    ),
    nextOccurrenceDate: $checkedConvert(
      'nextOccurrenceDate',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    lastOccurrenceDate: $checkedConvert(
      'lastOccurrenceDate',
      (v) => DateTime.parse(v as String),
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    cancelledAt: $checkedConvert(
      'cancelledAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$PixScheduleToJson(PixSchedule instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': _$PixScheduleStatusEnumEnumMap[instance.status]!,
      'amount': instance.amount.toJson(),
      'description': instance.description,
      'payee': instance.payee.toJson(),
      'firstDate': instance.firstDate.toIso8601String(),
      'recurrence': instance.recurrence.toJson(),
      'nextOccurrenceDate': instance.nextOccurrenceDate?.toIso8601String(),
      'lastOccurrenceDate': instance.lastOccurrenceDate.toIso8601String(),
      'createdAt': instance.createdAt.toIso8601String(),
      'cancelledAt': instance.cancelledAt?.toIso8601String(),
    };

const _$PixScheduleStatusEnumEnumMap = {
  PixScheduleStatusEnum.ACTIVE: 'ACTIVE',
  PixScheduleStatusEnum.FINISHED: 'FINISHED',
  PixScheduleStatusEnum.CANCELLED: 'CANCELLED',
  PixScheduleStatusEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
