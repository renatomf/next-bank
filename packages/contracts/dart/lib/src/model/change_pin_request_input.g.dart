// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'change_pin_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ChangePinRequestInputCWProxy {
  ChangePinRequestInput password(String password);

  ChangePinRequestInput newPin(String newPin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ChangePinRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ChangePinRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  ChangePinRequestInput call({String password, String newPin});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfChangePinRequestInput.copyWith(...)` or call `instanceOfChangePinRequestInput.copyWith.fieldName(value)` for a single field.
class _$ChangePinRequestInputCWProxyImpl
    implements _$ChangePinRequestInputCWProxy {
  const _$ChangePinRequestInputCWProxyImpl(this._value);

  final ChangePinRequestInput _value;

  @override
  ChangePinRequestInput password(String password) => call(password: password);

  @override
  ChangePinRequestInput newPin(String newPin) => call(newPin: newPin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ChangePinRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ChangePinRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  ChangePinRequestInput call({
    Object? password = const $CopyWithPlaceholder(),
    Object? newPin = const $CopyWithPlaceholder(),
  }) {
    return ChangePinRequestInput(
      password: password == const $CopyWithPlaceholder() || password == null
          ? _value.password
          // ignore: cast_nullable_to_non_nullable
          : password as String,
      newPin: newPin == const $CopyWithPlaceholder() || newPin == null
          ? _value.newPin
          // ignore: cast_nullable_to_non_nullable
          : newPin as String,
    );
  }
}

extension $ChangePinRequestInputCopyWith on ChangePinRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfChangePinRequestInput.copyWith(...)` or `instanceOfChangePinRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ChangePinRequestInputCWProxy get copyWith =>
      _$ChangePinRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChangePinRequestInput _$ChangePinRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ChangePinRequestInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['password', 'newPin']);
  final val = ChangePinRequestInput(
    password: $checkedConvert('password', (v) => v as String),
    newPin: $checkedConvert('newPin', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ChangePinRequestInputToJson(
  ChangePinRequestInput instance,
) => <String, dynamic>{
  'password': instance.password,
  'newPin': instance.newPin,
};
