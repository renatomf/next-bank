// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'change_password_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ChangePasswordRequestInputCWProxy {
  ChangePasswordRequestInput currentPassword(String currentPassword);

  ChangePasswordRequestInput newPassword(String newPassword);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ChangePasswordRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ChangePasswordRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  ChangePasswordRequestInput call({String currentPassword, String newPassword});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfChangePasswordRequestInput.copyWith(...)` or call `instanceOfChangePasswordRequestInput.copyWith.fieldName(value)` for a single field.
class _$ChangePasswordRequestInputCWProxyImpl
    implements _$ChangePasswordRequestInputCWProxy {
  const _$ChangePasswordRequestInputCWProxyImpl(this._value);

  final ChangePasswordRequestInput _value;

  @override
  ChangePasswordRequestInput currentPassword(String currentPassword) =>
      call(currentPassword: currentPassword);

  @override
  ChangePasswordRequestInput newPassword(String newPassword) =>
      call(newPassword: newPassword);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ChangePasswordRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ChangePasswordRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  ChangePasswordRequestInput call({
    Object? currentPassword = const $CopyWithPlaceholder(),
    Object? newPassword = const $CopyWithPlaceholder(),
  }) {
    return ChangePasswordRequestInput(
      currentPassword:
          currentPassword == const $CopyWithPlaceholder() ||
              currentPassword == null
          ? _value.currentPassword
          // ignore: cast_nullable_to_non_nullable
          : currentPassword as String,
      newPassword:
          newPassword == const $CopyWithPlaceholder() || newPassword == null
          ? _value.newPassword
          // ignore: cast_nullable_to_non_nullable
          : newPassword as String,
    );
  }
}

extension $ChangePasswordRequestInputCopyWith on ChangePasswordRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfChangePasswordRequestInput.copyWith(...)` or `instanceOfChangePasswordRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ChangePasswordRequestInputCWProxy get copyWith =>
      _$ChangePasswordRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ChangePasswordRequestInput _$ChangePasswordRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('ChangePasswordRequestInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['currentPassword', 'newPassword']);
  final val = ChangePasswordRequestInput(
    currentPassword: $checkedConvert('currentPassword', (v) => v as String),
    newPassword: $checkedConvert('newPassword', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$ChangePasswordRequestInputToJson(
  ChangePasswordRequestInput instance,
) => <String, dynamic>{
  'currentPassword': instance.currentPassword,
  'newPassword': instance.newPassword,
};
