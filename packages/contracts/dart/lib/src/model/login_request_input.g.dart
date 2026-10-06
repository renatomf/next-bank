// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'login_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$LoginRequestInputCWProxy {
  LoginRequestInput email(String email);

  LoginRequestInput password(String password);

  LoginRequestInput deviceLabel(String? deviceLabel);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `LoginRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// LoginRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  LoginRequestInput call({String email, String password, String? deviceLabel});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfLoginRequestInput.copyWith(...)` or call `instanceOfLoginRequestInput.copyWith.fieldName(value)` for a single field.
class _$LoginRequestInputCWProxyImpl implements _$LoginRequestInputCWProxy {
  const _$LoginRequestInputCWProxyImpl(this._value);

  final LoginRequestInput _value;

  @override
  LoginRequestInput email(String email) => call(email: email);

  @override
  LoginRequestInput password(String password) => call(password: password);

  @override
  LoginRequestInput deviceLabel(String? deviceLabel) =>
      call(deviceLabel: deviceLabel);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `LoginRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// LoginRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  LoginRequestInput call({
    Object? email = const $CopyWithPlaceholder(),
    Object? password = const $CopyWithPlaceholder(),
    Object? deviceLabel = const $CopyWithPlaceholder(),
  }) {
    return LoginRequestInput(
      email: email == const $CopyWithPlaceholder() || email == null
          ? _value.email
          // ignore: cast_nullable_to_non_nullable
          : email as String,
      password: password == const $CopyWithPlaceholder() || password == null
          ? _value.password
          // ignore: cast_nullable_to_non_nullable
          : password as String,
      deviceLabel: deviceLabel == const $CopyWithPlaceholder()
          ? _value.deviceLabel
          // ignore: cast_nullable_to_non_nullable
          : deviceLabel as String?,
    );
  }
}

extension $LoginRequestInputCopyWith on LoginRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfLoginRequestInput.copyWith(...)` or `instanceOfLoginRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$LoginRequestInputCWProxy get copyWith =>
      _$LoginRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

LoginRequestInput _$LoginRequestInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('LoginRequestInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['email', 'password']);
      final val = LoginRequestInput(
        email: $checkedConvert('email', (v) => v as String),
        password: $checkedConvert('password', (v) => v as String),
        deviceLabel: $checkedConvert('deviceLabel', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$LoginRequestInputToJson(LoginRequestInput instance) =>
    <String, dynamic>{
      'email': instance.email,
      'password': instance.password,
      'deviceLabel': ?instance.deviceLabel,
    };
