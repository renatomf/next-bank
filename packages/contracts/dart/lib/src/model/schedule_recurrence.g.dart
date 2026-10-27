// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'schedule_recurrence.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ScheduleRecurrenceCWProxy {
  ScheduleRecurrence frequency(ScheduleRecurrenceFrequencyEnum frequency);

  ScheduleRecurrence times(int times);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ScheduleRecurrence(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ScheduleRecurrence(...).copyWith(id: 12, name: "My name")
  /// ```
  ScheduleRecurrence call({
    ScheduleRecurrenceFrequencyEnum frequency,
    int times,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfScheduleRecurrence.copyWith(...)` or call `instanceOfScheduleRecurrence.copyWith.fieldName(value)` for a single field.
class _$ScheduleRecurrenceCWProxyImpl implements _$ScheduleRecurrenceCWProxy {
  const _$ScheduleRecurrenceCWProxyImpl(this._value);

  final ScheduleRecurrence _value;

  @override
  ScheduleRecurrence frequency(ScheduleRecurrenceFrequencyEnum frequency) =>
      call(frequency: frequency);

  @override
  ScheduleRecurrence times(int times) => call(times: times);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ScheduleRecurrence(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ScheduleRecurrence(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  ScheduleRecurrence call({
    Object? frequency = const $CopyWithPlaceholder(),
    Object? times = const $CopyWithPlaceholder(),
  }) {
    return ScheduleRecurrence(
      frequency: frequency == const $CopyWithPlaceholder() || frequency == null
          ? _value.frequency
          // ignore: cast_nullable_to_non_nullable
          : frequency as ScheduleRecurrenceFrequencyEnum,
      times: times == const $CopyWithPlaceholder() || times == null
          ? _value.times
          // ignore: cast_nullable_to_non_nullable
          : times as int,
    );
  }
}

extension $ScheduleRecurrenceCopyWith on ScheduleRecurrence {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfScheduleRecurrence.copyWith(...)` or `instanceOfScheduleRecurrence.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ScheduleRecurrenceCWProxy get copyWith =>
      _$ScheduleRecurrenceCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ScheduleRecurrence _$ScheduleRecurrenceFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ScheduleRecurrence', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['frequency', 'times']);
      final val = ScheduleRecurrence(
        frequency: $checkedConvert(
          'frequency',
          (v) => $enumDecode(
            _$ScheduleRecurrenceFrequencyEnumEnumMap,
            v,
            unknownValue: ScheduleRecurrenceFrequencyEnum.unknownDefaultOpenApi,
          ),
        ),
        times: $checkedConvert('times', (v) => (v as num).toInt()),
      );
      return val;
    });

Map<String, dynamic> _$ScheduleRecurrenceToJson(
  ScheduleRecurrence instance,
) => <String, dynamic>{
  'frequency': _$ScheduleRecurrenceFrequencyEnumEnumMap[instance.frequency]!,
  'times': instance.times,
};

const _$ScheduleRecurrenceFrequencyEnumEnumMap = {
  ScheduleRecurrenceFrequencyEnum.ONCE: 'ONCE',
  ScheduleRecurrenceFrequencyEnum.MONTHLY: 'MONTHLY',
  ScheduleRecurrenceFrequencyEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
