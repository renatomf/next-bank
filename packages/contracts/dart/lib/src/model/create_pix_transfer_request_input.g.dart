// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_pix_transfer_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreatePixTransferRequestInputCWProxy {
  CreatePixTransferRequestInput key(CreatePixTransferRequestInputKey key);

  CreatePixTransferRequestInput amount(MoneyInput amount);

  CreatePixTransferRequestInput description(String? description);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreatePixTransferRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreatePixTransferRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  CreatePixTransferRequestInput call({
    CreatePixTransferRequestInputKey key,
    MoneyInput amount,
    String? description,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfCreatePixTransferRequestInput.copyWith(...)` or call `instanceOfCreatePixTransferRequestInput.copyWith.fieldName(value)` for a single field.
class _$CreatePixTransferRequestInputCWProxyImpl
    implements _$CreatePixTransferRequestInputCWProxy {
  const _$CreatePixTransferRequestInputCWProxyImpl(this._value);

  final CreatePixTransferRequestInput _value;

  @override
  CreatePixTransferRequestInput key(CreatePixTransferRequestInputKey key) =>
      call(key: key);

  @override
  CreatePixTransferRequestInput amount(MoneyInput amount) =>
      call(amount: amount);

  @override
  CreatePixTransferRequestInput description(String? description) =>
      call(description: description);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreatePixTransferRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreatePixTransferRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  CreatePixTransferRequestInput call({
    Object? key = const $CopyWithPlaceholder(),
    Object? amount = const $CopyWithPlaceholder(),
    Object? description = const $CopyWithPlaceholder(),
  }) {
    return CreatePixTransferRequestInput(
      key: key == const $CopyWithPlaceholder() || key == null
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as CreatePixTransferRequestInputKey,
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as MoneyInput,
      description: description == const $CopyWithPlaceholder()
          ? _value.description
          // ignore: cast_nullable_to_non_nullable
          : description as String?,
    );
  }
}

extension $CreatePixTransferRequestInputCopyWith
    on CreatePixTransferRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfCreatePixTransferRequestInput.copyWith(...)` or `instanceOfCreatePixTransferRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreatePixTransferRequestInputCWProxy get copyWith =>
      _$CreatePixTransferRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreatePixTransferRequestInput _$CreatePixTransferRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('CreatePixTransferRequestInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['key', 'amount']);
  final val = CreatePixTransferRequestInput(
    key: $checkedConvert(
      'key',
      (v) =>
          CreatePixTransferRequestInputKey.fromJson(v as Map<String, dynamic>),
    ),
    amount: $checkedConvert(
      'amount',
      (v) => MoneyInput.fromJson(v as Map<String, dynamic>),
    ),
    description: $checkedConvert('description', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$CreatePixTransferRequestInputToJson(
  CreatePixTransferRequestInput instance,
) => <String, dynamic>{
  'key': instance.key.toJson(),
  'amount': instance.amount.toJson(),
  'description': ?instance.description,
};
