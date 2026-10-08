// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_key_lookup_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixKeyLookupRequestInputCWProxy {
  PixKeyLookupRequestInput type(PixKeyLookupRequestInputTypeEnum type);

  PixKeyLookupRequestInput value(String value);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixKeyLookupRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixKeyLookupRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  PixKeyLookupRequestInput call({
    PixKeyLookupRequestInputTypeEnum type,
    String value,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixKeyLookupRequestInput.copyWith(...)` or call `instanceOfPixKeyLookupRequestInput.copyWith.fieldName(value)` for a single field.
class _$PixKeyLookupRequestInputCWProxyImpl
    implements _$PixKeyLookupRequestInputCWProxy {
  const _$PixKeyLookupRequestInputCWProxyImpl(this._value);

  final PixKeyLookupRequestInput _value;

  @override
  PixKeyLookupRequestInput type(PixKeyLookupRequestInputTypeEnum type) =>
      call(type: type);

  @override
  PixKeyLookupRequestInput value(String value) => call(value: value);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixKeyLookupRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixKeyLookupRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixKeyLookupRequestInput call({
    Object? type = const $CopyWithPlaceholder(),
    Object? value = const $CopyWithPlaceholder(),
  }) {
    return PixKeyLookupRequestInput(
      type: type == const $CopyWithPlaceholder() || type == null
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as PixKeyLookupRequestInputTypeEnum,
      value: value == const $CopyWithPlaceholder() || value == null
          ? _value.value
          // ignore: cast_nullable_to_non_nullable
          : value as String,
    );
  }
}

extension $PixKeyLookupRequestInputCopyWith on PixKeyLookupRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixKeyLookupRequestInput.copyWith(...)` or `instanceOfPixKeyLookupRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixKeyLookupRequestInputCWProxy get copyWith =>
      _$PixKeyLookupRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixKeyLookupRequestInput _$PixKeyLookupRequestInputFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('PixKeyLookupRequestInput', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['type', 'value']);
  final val = PixKeyLookupRequestInput(
    type: $checkedConvert(
      'type',
      (v) => $enumDecode(_$PixKeyLookupRequestInputTypeEnumEnumMap, v),
    ),
    value: $checkedConvert('value', (v) => v as String),
  );
  return val;
});

Map<String, dynamic> _$PixKeyLookupRequestInputToJson(
  PixKeyLookupRequestInput instance,
) => <String, dynamic>{
  'type': _$PixKeyLookupRequestInputTypeEnumEnumMap[instance.type]!,
  'value': instance.value,
};

const _$PixKeyLookupRequestInputTypeEnumEnumMap = {
  PixKeyLookupRequestInputTypeEnum.CPF: 'CPF',
  PixKeyLookupRequestInputTypeEnum.EMAIL: 'EMAIL',
  PixKeyLookupRequestInputTypeEnum.PHONE: 'PHONE',
  PixKeyLookupRequestInputTypeEnum.RANDOM: 'RANDOM',
};
