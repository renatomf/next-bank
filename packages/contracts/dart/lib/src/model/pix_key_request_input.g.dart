// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_key_request_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixKeyRequestInputCWProxy {
  PixKeyRequestInput type(PixKeyRequestInputTypeEnum type);

  PixKeyRequestInput value(String value);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixKeyRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixKeyRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  PixKeyRequestInput call({PixKeyRequestInputTypeEnum type, String value});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixKeyRequestInput.copyWith(...)` or call `instanceOfPixKeyRequestInput.copyWith.fieldName(value)` for a single field.
class _$PixKeyRequestInputCWProxyImpl implements _$PixKeyRequestInputCWProxy {
  const _$PixKeyRequestInputCWProxyImpl(this._value);

  final PixKeyRequestInput _value;

  @override
  PixKeyRequestInput type(PixKeyRequestInputTypeEnum type) => call(type: type);

  @override
  PixKeyRequestInput value(String value) => call(value: value);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixKeyRequestInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixKeyRequestInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixKeyRequestInput call({
    Object? type = const $CopyWithPlaceholder(),
    Object? value = const $CopyWithPlaceholder(),
  }) {
    return PixKeyRequestInput(
      type: type == const $CopyWithPlaceholder() || type == null
          ? _value.type
          // ignore: cast_nullable_to_non_nullable
          : type as PixKeyRequestInputTypeEnum,
      value: value == const $CopyWithPlaceholder() || value == null
          ? _value.value
          // ignore: cast_nullable_to_non_nullable
          : value as String,
    );
  }
}

extension $PixKeyRequestInputCopyWith on PixKeyRequestInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixKeyRequestInput.copyWith(...)` or `instanceOfPixKeyRequestInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixKeyRequestInputCWProxy get copyWith =>
      _$PixKeyRequestInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixKeyRequestInput _$PixKeyRequestInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PixKeyRequestInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['type', 'value']);
      final val = PixKeyRequestInput(
        type: $checkedConvert(
          'type',
          (v) => $enumDecode(
            _$PixKeyRequestInputTypeEnumEnumMap,
            v,
            unknownValue: PixKeyRequestInputTypeEnum.unknownDefaultOpenApi,
          ),
        ),
        value: $checkedConvert('value', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PixKeyRequestInputToJson(PixKeyRequestInput instance) =>
    <String, dynamic>{
      'type': _$PixKeyRequestInputTypeEnumEnumMap[instance.type]!,
      'value': instance.value,
    };

const _$PixKeyRequestInputTypeEnumEnumMap = {
  PixKeyRequestInputTypeEnum.CPF: 'CPF',
  PixKeyRequestInputTypeEnum.EMAIL: 'EMAIL',
  PixKeyRequestInputTypeEnum.PHONE: 'PHONE',
  PixKeyRequestInputTypeEnum.RANDOM: 'RANDOM',
  PixKeyRequestInputTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
