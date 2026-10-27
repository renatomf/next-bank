// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_payee.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixPayeeCWProxy {
  PixPayee name(String name);

  PixPayee documentMasked(String documentMasked);

  PixPayee keyType(PixPayeeKeyTypeEnum keyType);

  PixPayee keyMasked(String keyMasked);

  PixPayee bank(PixPayeeBank? bank);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixPayee(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixPayee(...).copyWith(id: 12, name: "My name")
  /// ```
  PixPayee call({
    String name,
    String documentMasked,
    PixPayeeKeyTypeEnum keyType,
    String keyMasked,
    PixPayeeBank? bank,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixPayee.copyWith(...)` or call `instanceOfPixPayee.copyWith.fieldName(value)` for a single field.
class _$PixPayeeCWProxyImpl implements _$PixPayeeCWProxy {
  const _$PixPayeeCWProxyImpl(this._value);

  final PixPayee _value;

  @override
  PixPayee name(String name) => call(name: name);

  @override
  PixPayee documentMasked(String documentMasked) =>
      call(documentMasked: documentMasked);

  @override
  PixPayee keyType(PixPayeeKeyTypeEnum keyType) => call(keyType: keyType);

  @override
  PixPayee keyMasked(String keyMasked) => call(keyMasked: keyMasked);

  @override
  PixPayee bank(PixPayeeBank? bank) => call(bank: bank);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixPayee(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixPayee(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixPayee call({
    Object? name = const $CopyWithPlaceholder(),
    Object? documentMasked = const $CopyWithPlaceholder(),
    Object? keyType = const $CopyWithPlaceholder(),
    Object? keyMasked = const $CopyWithPlaceholder(),
    Object? bank = const $CopyWithPlaceholder(),
  }) {
    return PixPayee(
      name: name == const $CopyWithPlaceholder() || name == null
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      documentMasked:
          documentMasked == const $CopyWithPlaceholder() ||
              documentMasked == null
          ? _value.documentMasked
          // ignore: cast_nullable_to_non_nullable
          : documentMasked as String,
      keyType: keyType == const $CopyWithPlaceholder() || keyType == null
          ? _value.keyType
          // ignore: cast_nullable_to_non_nullable
          : keyType as PixPayeeKeyTypeEnum,
      keyMasked: keyMasked == const $CopyWithPlaceholder() || keyMasked == null
          ? _value.keyMasked
          // ignore: cast_nullable_to_non_nullable
          : keyMasked as String,
      bank: bank == const $CopyWithPlaceholder()
          ? _value.bank
          // ignore: cast_nullable_to_non_nullable
          : bank as PixPayeeBank?,
    );
  }
}

extension $PixPayeeCopyWith on PixPayee {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixPayee.copyWith(...)` or `instanceOfPixPayee.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixPayeeCWProxy get copyWith => _$PixPayeeCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixPayee _$PixPayeeFromJson(Map<String, dynamic> json) => $checkedCreate(
  'PixPayee',
  json,
  ($checkedConvert) {
    $checkKeys(
      json,
      requiredKeys: const ['name', 'documentMasked', 'keyType', 'keyMasked'],
    );
    final val = PixPayee(
      name: $checkedConvert('name', (v) => v as String),
      documentMasked: $checkedConvert('documentMasked', (v) => v as String),
      keyType: $checkedConvert(
        'keyType',
        (v) => $enumDecode(
          _$PixPayeeKeyTypeEnumEnumMap,
          v,
          unknownValue: PixPayeeKeyTypeEnum.unknownDefaultOpenApi,
        ),
      ),
      keyMasked: $checkedConvert('keyMasked', (v) => v as String),
      bank: $checkedConvert(
        'bank',
        (v) =>
            v == null ? null : PixPayeeBank.fromJson(v as Map<String, dynamic>),
      ),
    );
    return val;
  },
);

Map<String, dynamic> _$PixPayeeToJson(PixPayee instance) => <String, dynamic>{
  'name': instance.name,
  'documentMasked': instance.documentMasked,
  'keyType': _$PixPayeeKeyTypeEnumEnumMap[instance.keyType]!,
  'keyMasked': instance.keyMasked,
  'bank': ?instance.bank?.toJson(),
};

const _$PixPayeeKeyTypeEnumEnumMap = {
  PixPayeeKeyTypeEnum.CPF: 'CPF',
  PixPayeeKeyTypeEnum.EMAIL: 'EMAIL',
  PixPayeeKeyTypeEnum.PHONE: 'PHONE',
  PixPayeeKeyTypeEnum.RANDOM: 'RANDOM',
  PixPayeeKeyTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
