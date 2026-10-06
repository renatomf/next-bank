// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'register_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$RegisterRequestInputCWProxy {
  RegisterRequestInput name(String name);

  RegisterRequestInput email(String email);

  RegisterRequestInput cpf(String cpf);

  RegisterRequestInput password(String password);

  RegisterRequestInput deviceLabel(String? deviceLabel);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `RegisterRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// RegisterRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  RegisterRequestInput call({
    String name,
    String email,
    String cpf,
    String password,
    String? deviceLabel,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfRegisterRequestInput.copyWith(...)` or call `instanceOfRegisterRequestInput.copyWith.fieldName(value)` for a single field.
class _$RegisterRequestInputCWProxyImpl
    implements _$RegisterRequestInputCWProxy {
  const _$RegisterRequestInputCWProxyImpl(this._value);

  final RegisterRequestInput _value;

  @override
  RegisterRequestInput name(String name) => call(name: name);

  @override
  RegisterRequestInput email(String email) => call(email: email);

  @override
  RegisterRequestInput cpf(String cpf) => call(cpf: cpf);

  @override
  RegisterRequestInput password(String password) => call(password: password);

  @override
  RegisterRequestInput deviceLabel(String? deviceLabel) =>
      call(deviceLabel: deviceLabel);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `RegisterRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// RegisterRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  RegisterRequestInput call({
    Object? name = const $CopyWithPlaceholder(),
    Object? email = const $CopyWithPlaceholder(),
    Object? cpf = const $CopyWithPlaceholder(),
    Object? password = const $CopyWithPlaceholder(),
    Object? deviceLabel = const $CopyWithPlaceholder(),
  }) {
    return RegisterRequestInput(
      name: name == const $CopyWithPlaceholder() || name == null
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      email: email == const $CopyWithPlaceholder() || email == null
          ? _value.email
          // ignore: cast_nullable_to_non_nullable
          : email as String,
      cpf: cpf == const $CopyWithPlaceholder() || cpf == null
          ? _value.cpf
          // ignore: cast_nullable_to_non_nullable
          : cpf as String,
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

extension $RegisterRequestInputCopyWith on RegisterRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfRegisterRequestInput.copyWith(...)` or `instanceOfRegisterRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$RegisterRequestInputCWProxy get copyWith =>
      _$RegisterRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RegisterRequestInput _$RegisterRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('RegisterRequestInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['name', 'email', 'cpf', 'password']);
  final val = RegisterRequestInput(
    name: $checkedConvert('name', (v) => v as String),
    email: $checkedConvert('email', (v) => v as String),
    cpf: $checkedConvert('cpf', (v) => v as String),
    password: $checkedConvert('password', (v) => v as String),
    deviceLabel: $checkedConvert('deviceLabel', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$RegisterRequestInputToJson(
  RegisterRequestInput instance,
) => <String, dynamic>{
  'name': instance.name,
  'email': instance.email,
  'cpf': instance.cpf,
  'password': instance.password,
  'deviceLabel': ?instance.deviceLabel,
};
