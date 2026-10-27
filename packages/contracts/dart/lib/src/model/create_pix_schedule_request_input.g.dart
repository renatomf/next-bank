// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_pix_schedule_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreatePixScheduleRequestInputCWProxy {
  CreatePixScheduleRequestInput key(PixKeyRequestInput key);

  CreatePixScheduleRequestInput amount(MoneyInput amount);

  CreatePixScheduleRequestInput description(String? description);

  CreatePixScheduleRequestInput firstDate(String firstDate);

  CreatePixScheduleRequestInput recurrence(
    ScheduleRecurrenceRequestInput recurrence,
  );

  CreatePixScheduleRequestInput pin(String pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreatePixScheduleRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreatePixScheduleRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  CreatePixScheduleRequestInput call({
    PixKeyRequestInput key,
    MoneyInput amount,
    String? description,
    String firstDate,
    ScheduleRecurrenceRequestInput recurrence,
    String pin,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfCreatePixScheduleRequestInput.copyWith(...)` or call `instanceOfCreatePixScheduleRequestInput.copyWith.fieldName(value)` for a single field.
class _$CreatePixScheduleRequestInputCWProxyImpl
    implements _$CreatePixScheduleRequestInputCWProxy {
  const _$CreatePixScheduleRequestInputCWProxyImpl(this._value);

  final CreatePixScheduleRequestInput _value;

  @override
  CreatePixScheduleRequestInput key(PixKeyRequestInput key) => call(key: key);

  @override
  CreatePixScheduleRequestInput amount(MoneyInput amount) =>
      call(amount: amount);

  @override
  CreatePixScheduleRequestInput description(String? description) =>
      call(description: description);

  @override
  CreatePixScheduleRequestInput firstDate(String firstDate) =>
      call(firstDate: firstDate);

  @override
  CreatePixScheduleRequestInput recurrence(
    ScheduleRecurrenceRequestInput recurrence,
  ) => call(recurrence: recurrence);

  @override
  CreatePixScheduleRequestInput pin(String pin) => call(pin: pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreatePixScheduleRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreatePixScheduleRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  CreatePixScheduleRequestInput call({
    Object? key = const $CopyWithPlaceholder(),
    Object? amount = const $CopyWithPlaceholder(),
    Object? description = const $CopyWithPlaceholder(),
    Object? firstDate = const $CopyWithPlaceholder(),
    Object? recurrence = const $CopyWithPlaceholder(),
    Object? pin = const $CopyWithPlaceholder(),
  }) {
    return CreatePixScheduleRequestInput(
      key: key == const $CopyWithPlaceholder() || key == null
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as PixKeyRequestInput,
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as MoneyInput,
      description: description == const $CopyWithPlaceholder()
          ? _value.description
          // ignore: cast_nullable_to_non_nullable
          : description as String?,
      firstDate: firstDate == const $CopyWithPlaceholder() || firstDate == null
          ? _value.firstDate
          // ignore: cast_nullable_to_non_nullable
          : firstDate as String,
      recurrence:
          recurrence == const $CopyWithPlaceholder() || recurrence == null
          ? _value.recurrence
          // ignore: cast_nullable_to_non_nullable
          : recurrence as ScheduleRecurrenceRequestInput,
      pin: pin == const $CopyWithPlaceholder() || pin == null
          ? _value.pin
          // ignore: cast_nullable_to_non_nullable
          : pin as String,
    );
  }
}

extension $CreatePixScheduleRequestInputCopyWith
    on CreatePixScheduleRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfCreatePixScheduleRequestInput.copyWith(...)` or `instanceOfCreatePixScheduleRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreatePixScheduleRequestInputCWProxy get copyWith =>
      _$CreatePixScheduleRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreatePixScheduleRequestInput _$CreatePixScheduleRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreatePixScheduleRequestInput', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['key', 'amount', 'firstDate', 'recurrence', 'pin'],
  );
  final val = CreatePixScheduleRequestInput(
    key: $checkedConvert(
      'key',
      (v) => PixKeyRequestInput.fromJson(v as Map<String, dynamic>),
    ),
    amount: $checkedConvert(
      'amount',
      (v) => MoneyInput.fromJson(v as Map<String, dynamic>),
    ),
    description: $checkedConvert('description', (v) => v as String?),
    firstDate: $checkedConvert('firstDate', (v) => v as String),
    recurrence: $checkedConvert(
      'recurrence',
      (v) => ScheduleRecurrenceRequestInput.fromJson(v as Map<String, dynamic>),
    ),
    pin: $checkedConvert('pin', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$CreatePixScheduleRequestInputToJson(
  CreatePixScheduleRequestInput instance,
) => <String, dynamic>{
  'key': instance.key.toJson(),
  'amount': instance.amount.toJson(),
  'description': ?instance.description,
  'firstDate': instance.firstDate,
  'recurrence': instance.recurrence.toJson(),
  'pin': instance.pin,
};
