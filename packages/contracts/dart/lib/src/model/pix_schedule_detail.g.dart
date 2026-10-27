// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_schedule_detail.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixScheduleDetailCWProxy {
  PixScheduleDetail id(String id);

  PixScheduleDetail status(PixScheduleDetailStatusEnum status);

  PixScheduleDetail amount(Money amount);

  PixScheduleDetail description(String? description);

  PixScheduleDetail payee(PixSchedulePayee payee);

  PixScheduleDetail firstDate(String firstDate);

  PixScheduleDetail recurrence(ScheduleRecurrence recurrence);

  PixScheduleDetail nextOccurrenceDate(String? nextOccurrenceDate);

  PixScheduleDetail lastOccurrenceDate(String lastOccurrenceDate);

  PixScheduleDetail createdAt(DateTime createdAt);

  PixScheduleDetail cancelledAt(DateTime? cancelledAt);

  PixScheduleDetail occurrences(List<PixScheduleOccurrence> occurrences);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixScheduleDetail(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixScheduleDetail(...).copyWith(id: 12, name: "My name")
  /// ```
  PixScheduleDetail call({
    String id,
    PixScheduleDetailStatusEnum status,
    Money amount,
    String? description,
    PixSchedulePayee payee,
    String firstDate,
    ScheduleRecurrence recurrence,
    String? nextOccurrenceDate,
    String lastOccurrenceDate,
    DateTime createdAt,
    DateTime? cancelledAt,
    List<PixScheduleOccurrence> occurrences,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixScheduleDetail.copyWith(...)` or call `instanceOfPixScheduleDetail.copyWith.fieldName(value)` for a single field.
class _$PixScheduleDetailCWProxyImpl implements _$PixScheduleDetailCWProxy {
  const _$PixScheduleDetailCWProxyImpl(this._value);

  final PixScheduleDetail _value;

  @override
  PixScheduleDetail id(String id) => call(id: id);

  @override
  PixScheduleDetail status(PixScheduleDetailStatusEnum status) =>
      call(status: status);

  @override
  PixScheduleDetail amount(Money amount) => call(amount: amount);

  @override
  PixScheduleDetail description(String? description) =>
      call(description: description);

  @override
  PixScheduleDetail payee(PixSchedulePayee payee) => call(payee: payee);

  @override
  PixScheduleDetail firstDate(String firstDate) => call(firstDate: firstDate);

  @override
  PixScheduleDetail recurrence(ScheduleRecurrence recurrence) =>
      call(recurrence: recurrence);

  @override
  PixScheduleDetail nextOccurrenceDate(String? nextOccurrenceDate) =>
      call(nextOccurrenceDate: nextOccurrenceDate);

  @override
  PixScheduleDetail lastOccurrenceDate(String lastOccurrenceDate) =>
      call(lastOccurrenceDate: lastOccurrenceDate);

  @override
  PixScheduleDetail createdAt(DateTime createdAt) => call(createdAt: createdAt);

  @override
  PixScheduleDetail cancelledAt(DateTime? cancelledAt) =>
      call(cancelledAt: cancelledAt);

  @override
  PixScheduleDetail occurrences(List<PixScheduleOccurrence> occurrences) =>
      call(occurrences: occurrences);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixScheduleDetail(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixScheduleDetail(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixScheduleDetail call({
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
    Object? occurrences = const $CopyWithPlaceholder(),
  }) {
    return PixScheduleDetail(
      id: id == const $CopyWithPlaceholder() || id == null
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      status: status == const $CopyWithPlaceholder() || status == null
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as PixScheduleDetailStatusEnum,
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
          : firstDate as String,
      recurrence:
          recurrence == const $CopyWithPlaceholder() || recurrence == null
          ? _value.recurrence
          // ignore: cast_nullable_to_non_nullable
          : recurrence as ScheduleRecurrence,
      nextOccurrenceDate: nextOccurrenceDate == const $CopyWithPlaceholder()
          ? _value.nextOccurrenceDate
          // ignore: cast_nullable_to_non_nullable
          : nextOccurrenceDate as String?,
      lastOccurrenceDate:
          lastOccurrenceDate == const $CopyWithPlaceholder() ||
              lastOccurrenceDate == null
          ? _value.lastOccurrenceDate
          // ignore: cast_nullable_to_non_nullable
          : lastOccurrenceDate as String,
      createdAt: createdAt == const $CopyWithPlaceholder() || createdAt == null
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      cancelledAt: cancelledAt == const $CopyWithPlaceholder()
          ? _value.cancelledAt
          // ignore: cast_nullable_to_non_nullable
          : cancelledAt as DateTime?,
      occurrences:
          occurrences == const $CopyWithPlaceholder() || occurrences == null
          ? _value.occurrences
          // ignore: cast_nullable_to_non_nullable
          : occurrences as List<PixScheduleOccurrence>,
    );
  }
}

extension $PixScheduleDetailCopyWith on PixScheduleDetail {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixScheduleDetail.copyWith(...)` or `instanceOfPixScheduleDetail.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixScheduleDetailCWProxy get copyWith =>
      _$PixScheduleDetailCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixScheduleDetail _$PixScheduleDetailFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('PixScheduleDetail', json, ($checkedConvert) {
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
      'occurrences',
    ],
  );
  final val = PixScheduleDetail(
    id: $checkedConvert('id', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$PixScheduleDetailStatusEnumEnumMap,
        v,
        unknownValue: PixScheduleDetailStatusEnum.unknownDefaultOpenApi,
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
    firstDate: $checkedConvert('firstDate', (v) => v as String),
    recurrence: $checkedConvert(
      'recurrence',
      (v) => ScheduleRecurrence.fromJson(v as Map<String, dynamic>),
    ),
    nextOccurrenceDate: $checkedConvert(
      'nextOccurrenceDate',
      (v) => v as String?,
    ),
    lastOccurrenceDate: $checkedConvert(
      'lastOccurrenceDate',
      (v) => v as String,
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    cancelledAt: $checkedConvert(
      'cancelledAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
    occurrences: $checkedConvert(
      'occurrences',
      (v) => (v as List<dynamic>)
          .map((e) => PixScheduleOccurrence.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$PixScheduleDetailToJson(PixScheduleDetail instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': _$PixScheduleDetailStatusEnumEnumMap[instance.status]!,
      'amount': instance.amount.toJson(),
      'description': instance.description,
      'payee': instance.payee.toJson(),
      'firstDate': instance.firstDate,
      'recurrence': instance.recurrence.toJson(),
      'nextOccurrenceDate': instance.nextOccurrenceDate,
      'lastOccurrenceDate': instance.lastOccurrenceDate,
      'createdAt': instance.createdAt.toIso8601String(),
      'cancelledAt': instance.cancelledAt?.toIso8601String(),
      'occurrences': instance.occurrences.map((e) => e.toJson()).toList(),
    };

const _$PixScheduleDetailStatusEnumEnumMap = {
  PixScheduleDetailStatusEnum.ACTIVE: 'ACTIVE',
  PixScheduleDetailStatusEnum.FINISHED: 'FINISHED',
  PixScheduleDetailStatusEnum.CANCELLED: 'CANCELLED',
  PixScheduleDetailStatusEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
