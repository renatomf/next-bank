// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_pix_transfer_request_input_key.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$CreatePixTransferRequestInputKeyCWProxy {
  CreatePixTransferRequestInputKey type(
    CreatePixTransferRequestInputKeyTypeEnum type,
  );

  CreatePixTransferRequestInputKey value(String value);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreatePixTransferRequestInputKey(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreatePixTransferRequestInputKey(...).copyWith(id: 12, name: "My name")
  /// ```
  CreatePixTransferRequestInputKey call({
    CreatePixTransferRequestInputKeyTypeEnum type,
    String value,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfCreatePixTransferRequestInputKey.copyWith(...)` or call `instanceOfCreatePixTransferRequestInputKey.copyWith.fieldName(value)` for a single field.
class _$CreatePixTransferRequestInputKeyCWProxyImpl
    implements _$CreatePixTransferRequestInputKeyCWProxy {
  const _$CreatePixTransferRequestInputKeyCWProxyImpl(this._value);

  final CreatePixTransferRequestInputKey _value;

  @override
  CreatePixTransferRequestInputKey type(
    CreatePixTransferRequestInputKeyTypeEnum type,
  ) => call(type: type);

  @override
  CreatePixTransferRequestInputKey value(String value) => call(value: value);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `CreatePixTransferRequestInputKey(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// CreatePixTransferRequestInputKey(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  CreatePixTransferRequestInputKey call({
    Object? type = const $CopyWithPlaceholder(),
    Object? value = const $CopyWithPlaceholder(),
  }) {
    return CreatePixTransferRequestInputKey(
      type: type == const $CopyWithPlaceholder() || type == null
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as CreatePixTransferRequestInputKeyTypeEnum,
      value: value == const $CopyWithPlaceholder() || value == null
          ? _value.value
          // ignore: cast_nullable_to_non_nullable
          : value as String,
    );
  }
}

extension $CreatePixTransferRequestInputKeyCopyWith
    on CreatePixTransferRequestInputKey {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfCreatePixTransferRequestInputKey.copyWith(...)` or `instanceOfCreatePixTransferRequestInputKey.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$CreatePixTransferRequestInputKeyCWProxy get copyWith =>
      _$CreatePixTransferRequestInputKeyCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

CreatePixTransferRequestInputKey _$CreatePixTransferRequestInputKeyFromJson(
  Map<String, dynamic> json,
) =>
    $checkedCreate('CreatePixTransferRequestInputKey', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['type', 'value']);
      final val = CreatePixTransferRequestInputKey(
        type: $checkedConvert(
          'type',
          (v) =>
              $enumDecode(_$CreatePixTransferRequestInputKeyTypeEnumEnumMap, v),
        ),
        value: $checkedConvert('value', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$CreatePixTransferRequestInputKeyToJson(
  CreatePixTransferRequestInputKey instance,
) => <String, dynamic>{
  'type': _$CreatePixTransferRequestInputKeyTypeEnumEnumMap[instance.type]!,
  'value': instance.value,
};

const _$CreatePixTransferRequestInputKeyTypeEnumEnumMap = {
  CreatePixTransferRequestInputKeyTypeEnum.CPF: 'CPF',
  CreatePixTransferRequestInputKeyTypeEnum.EMAIL: 'EMAIL',
  CreatePixTransferRequestInputKeyTypeEnum.PHONE: 'PHONE',
  CreatePixTransferRequestInputKeyTypeEnum.RANDOM: 'RANDOM',
};
