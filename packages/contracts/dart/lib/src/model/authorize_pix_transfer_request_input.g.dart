// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'authorize_pix_transfer_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$AuthorizePixTransferRequestInputCWProxy {
  AuthorizePixTransferRequestInput pin(String pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `AuthorizePixTransferRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// AuthorizePixTransferRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  AuthorizePixTransferRequestInput call({String pin});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfAuthorizePixTransferRequestInput.copyWith(...)` or call `instanceOfAuthorizePixTransferRequestInput.copyWith.fieldName(value)` for a single field.
class _$AuthorizePixTransferRequestInputCWProxyImpl
    implements _$AuthorizePixTransferRequestInputCWProxy {
  const _$AuthorizePixTransferRequestInputCWProxyImpl(this._value);

  final AuthorizePixTransferRequestInput _value;

  @override
  AuthorizePixTransferRequestInput pin(String pin) => call(pin: pin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `AuthorizePixTransferRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// AuthorizePixTransferRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  AuthorizePixTransferRequestInput call({
    Object? pin = const $CopyWithPlaceholder(),
  }) {
    return AuthorizePixTransferRequestInput(
      pin: pin == const $CopyWithPlaceholder() || pin == null
          ? _value.pin
          // ignore: cast_nullable_to_non_nullable
          : pin as String,
    );
  }
}

extension $AuthorizePixTransferRequestInputCopyWith
    on AuthorizePixTransferRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfAuthorizePixTransferRequestInput.copyWith(...)` or `instanceOfAuthorizePixTransferRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$AuthorizePixTransferRequestInputCWProxy get copyWith =>
      _$AuthorizePixTransferRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

AuthorizePixTransferRequestInput _$AuthorizePixTransferRequestInputFromJson(
  Map<String, dynamic> json,
) =>
    $checkedCreate('AuthorizePixTransferRequestInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['pin']);
      final val = AuthorizePixTransferRequestInput(
        pin: $checkedConvert('pin', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$AuthorizePixTransferRequestInputToJson(
  AuthorizePixTransferRequestInput instance,
) => <String, dynamic>{'pin': instance.pin};
