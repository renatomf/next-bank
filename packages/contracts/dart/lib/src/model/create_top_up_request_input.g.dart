// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_top_up_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreateTopUpRequestInputCWProxy {
  CreateTopUpRequestInput operatorId(String operatorId);

  CreateTopUpRequestInput phoneNumber(String phoneNumber);

  CreateTopUpRequestInput amount(MoneyInput amount);

  CreateTopUpRequestInput pin(String pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreateTopUpRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreateTopUpRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  CreateTopUpRequestInput call({
    String operatorId,
    String phoneNumber,
    MoneyInput amount,
    String pin,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfCreateTopUpRequestInput.copyWith(...)` or call `instanceOfCreateTopUpRequestInput.copyWith.fieldName(value)` for a single field.
class _$CreateTopUpRequestInputCWProxyImpl
    implements _$CreateTopUpRequestInputCWProxy {
  const _$CreateTopUpRequestInputCWProxyImpl(this._value);

  final CreateTopUpRequestInput _value;

  @override
  CreateTopUpRequestInput operatorId(String operatorId) =>
      call(operatorId: operatorId);

  @override
  CreateTopUpRequestInput phoneNumber(String phoneNumber) =>
      call(phoneNumber: phoneNumber);

  @override
  CreateTopUpRequestInput amount(MoneyInput amount) => call(amount: amount);

  @override
  CreateTopUpRequestInput pin(String pin) => call(pin: pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreateTopUpRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreateTopUpRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  CreateTopUpRequestInput call({
    Object? operatorId = const $CopyWithPlaceholder(),
    Object? phoneNumber = const $CopyWithPlaceholder(),
    Object? amount = const $CopyWithPlaceholder(),
    Object? pin = const $CopyWithPlaceholder(),
  }) {
    return CreateTopUpRequestInput(
      operatorId:
          operatorId == const $CopyWithPlaceholder() || operatorId == null
          ? _value.operatorId
          // ignore: cast_nullable_to_non_nullable
          : operatorId as String,
      phoneNumber:
          phoneNumber == const $CopyWithPlaceholder() || phoneNumber == null
          ? _value.phoneNumber
          // ignore: cast_nullable_to_non_nullable
          : phoneNumber as String,
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as MoneyInput,
      pin: pin == const $CopyWithPlaceholder() || pin == null
          ? _value.pin
          // ignore: cast_nullable_to_non_nullable
          : pin as String,
    );
  }
}

extension $CreateTopUpRequestInputCopyWith on CreateTopUpRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfCreateTopUpRequestInput.copyWith(...)` or `instanceOfCreateTopUpRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreateTopUpRequestInputCWProxy get copyWith =>
      _$CreateTopUpRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreateTopUpRequestInput _$CreateTopUpRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreateTopUpRequestInput', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const ['operatorId', 'phoneNumber', 'amount', 'pin'],
  );
  final val = CreateTopUpRequestInput(
    operatorId: $checkedConvert('operatorId', (v) => v as String),
    phoneNumber: $checkedConvert('phoneNumber', (v) => v as String),
    amount: $checkedConvert(
      'amount',
      (v) => MoneyInput.fromJson(v as Map<String, dynamic>),
    ),
    pin: $checkedConvert('pin', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$CreateTopUpRequestInputToJson(
  CreateTopUpRequestInput instance,
) => <String, dynamic>{
  'operatorId': instance.operatorId,
  'phoneNumber': instance.phoneNumber,
  'amount': instance.amount.toJson(),
  'pin': instance.pin,
};
