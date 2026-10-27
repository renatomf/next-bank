// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'schedule_recurrence_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ScheduleRecurrenceRequestInputCWProxy {
  ScheduleRecurrenceRequestInput frequency(
    ScheduleRecurrenceRequestInputFrequencyEnum frequency,
  );

  ScheduleRecurrenceRequestInput times(int? times);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ScheduleRecurrenceRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ScheduleRecurrenceRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  ScheduleRecurrenceRequestInput call({
    ScheduleRecurrenceRequestInputFrequencyEnum frequency,
    int? times,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfScheduleRecurrenceRequestInput.copyWith(...)` or call `instanceOfScheduleRecurrenceRequestInput.copyWith.fieldName(value)` for a single field.
class _$ScheduleRecurrenceRequestInputCWProxyImpl
    implements _$ScheduleRecurrenceRequestInputCWProxy {
  const _$ScheduleRecurrenceRequestInputCWProxyImpl(this._value);

  final ScheduleRecurrenceRequestInput _value;

  @override
  ScheduleRecurrenceRequestInput frequency(
    ScheduleRecurrenceRequestInputFrequencyEnum frequency,
  ) => call(frequency: frequency);

  @override
  ScheduleRecurrenceRequestInput times(int? times) => call(times: times);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ScheduleRecurrenceRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ScheduleRecurrenceRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  ScheduleRecurrenceRequestInput call({
    Object? frequency = const $CopyWithPlaceholder(),
    Object? times = const $CopyWithPlaceholder(),
  }) {
    return ScheduleRecurrenceRequestInput(
      frequency: frequency == const $CopyWithPlaceholder() || frequency == null
          ? _value.frequency
          // ignore: cast_nullable_to_non_nullable
          : frequency as ScheduleRecurrenceRequestInputFrequencyEnum,
      times: times == const $CopyWithPlaceholder()
          ? _value.times
          // ignore: cast_nullable_to_non_nullable
          : times as int?,
    );
  }
}

extension $ScheduleRecurrenceRequestInputCopyWith
    on ScheduleRecurrenceRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfScheduleRecurrenceRequestInput.copyWith(...)` or `instanceOfScheduleRecurrenceRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ScheduleRecurrenceRequestInputCWProxy get copyWith =>
      _$ScheduleRecurrenceRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ScheduleRecurrenceRequestInput _$ScheduleRecurrenceRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ScheduleRecurrenceRequestInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['frequency']);
  final val = ScheduleRecurrenceRequestInput(
    frequency: $checkedConvert(
      'frequency',
      (v) => $enumDecode(
        _$ScheduleRecurrenceRequestInputFrequencyEnumEnumMap,
        v,
        unknownValue:
            ScheduleRecurrenceRequestInputFrequencyEnum.unknownDefaultOpenApi,
      ),
    ),
    times: $checkedConvert('times', (v) => (v as num?)?.toInt()),
  );
  return val;
});

Map<String, dynamic> _$ScheduleRecurrenceRequestInputToJson(
  ScheduleRecurrenceRequestInput instance,
) => <String, dynamic>{
  'frequency':
      _$ScheduleRecurrenceRequestInputFrequencyEnumEnumMap[instance.frequency]!,
  'times': ?instance.times,
};

const _$ScheduleRecurrenceRequestInputFrequencyEnumEnumMap = {
  ScheduleRecurrenceRequestInputFrequencyEnum.ONCE: 'ONCE',
  ScheduleRecurrenceRequestInputFrequencyEnum.MONTHLY: 'MONTHLY',
  ScheduleRecurrenceRequestInputFrequencyEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
