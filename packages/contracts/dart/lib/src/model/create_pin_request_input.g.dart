// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_pin_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreatePinRequestInputCWProxy {
  CreatePinRequestInput pin(String pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreatePinRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreatePinRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  CreatePinRequestInput call({String pin});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfCreatePinRequestInput.copyWith(...)` or call `instanceOfCreatePinRequestInput.copyWith.fieldName(value)` for a single field.
class _$CreatePinRequestInputCWProxyImpl
    implements _$CreatePinRequestInputCWProxy {
  const _$CreatePinRequestInputCWProxyImpl(this._value);

  final CreatePinRequestInput _value;

  @override
  CreatePinRequestInput pin(String pin) => call(pin: pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreatePinRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreatePinRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  CreatePinRequestInput call({Object? pin = const $CopyWithPlaceholder()}) {
    return CreatePinRequestInput(
      pin: pin == const $CopyWithPlaceholder() || pin == null
          ? _value.pin
          // ignore: cast_nullable_to_non_nullable
          : pin as String,
    );
  }
}

extension $CreatePinRequestInputCopyWith on CreatePinRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfCreatePinRequestInput.copyWith(...)` or `instanceOfCreatePinRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreatePinRequestInputCWProxy get copyWith =>
      _$CreatePinRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreatePinRequestInput _$CreatePinRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreatePinRequestInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['pin']);
  final val = CreatePinRequestInput(
    pin: $checkedConvert('pin', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$CreatePinRequestInputToJson(
  CreatePinRequestInput instance,
) => <String, dynamic>{'pin': instance.pin};
