// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'verify_pin_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$VerifyPinRequestInputCWProxy {
  VerifyPinRequestInput pin(String pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `VerifyPinRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// VerifyPinRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  VerifyPinRequestInput call({String pin});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfVerifyPinRequestInput.copyWith(...)` or call `instanceOfVerifyPinRequestInput.copyWith.fieldName(value)` for a single field.
class _$VerifyPinRequestInputCWProxyImpl
    implements _$VerifyPinRequestInputCWProxy {
  const _$VerifyPinRequestInputCWProxyImpl(this._value);

  final VerifyPinRequestInput _value;

  @override
  VerifyPinRequestInput pin(String pin) => call(pin: pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `VerifyPinRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// VerifyPinRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  VerifyPinRequestInput call({Object? pin = const $CopyWithPlaceholder()}) {
    return VerifyPinRequestInput(
      pin: pin == const $CopyWithPlaceholder() || pin == null
          ? _value.pin
          // ignore: cast_nullable_to_non_nullable
          : pin as String,
    );
  }
}

extension $VerifyPinRequestInputCopyWith on VerifyPinRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfVerifyPinRequestInput.copyWith(...)` or `instanceOfVerifyPinRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$VerifyPinRequestInputCWProxy get copyWith =>
      _$VerifyPinRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

VerifyPinRequestInput _$VerifyPinRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('VerifyPinRequestInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['pin']);
  final val = VerifyPinRequestInput(
    pin: $checkedConvert('pin', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$VerifyPinRequestInputToJson(
  VerifyPinRequestInput instance,
) => <String, dynamic>{'pin': instance.pin};
