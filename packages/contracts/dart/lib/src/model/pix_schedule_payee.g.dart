// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_schedule_payee.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixSchedulePayeeCWProxy {
  PixSchedulePayee name(String name);

  PixSchedulePayee documentMasked(String documentMasked);

  PixSchedulePayee keyType(PixSchedulePayeeKeyTypeEnum keyType);

  PixSchedulePayee keyMasked(String keyMasked);

  PixSchedulePayee bank(PixPayeeBank? bank);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixSchedulePayee(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixSchedulePayee(...).copyWith(id: 12, name: "My name")
  /// ```
  PixSchedulePayee call({
    String name,
    String documentMasked,
    PixSchedulePayeeKeyTypeEnum keyType,
    String keyMasked,
    PixPayeeBank? bank,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixSchedulePayee.copyWith(...)` or call `instanceOfPixSchedulePayee.copyWith.fieldName(value)` for a single field.
class _$PixSchedulePayeeCWProxyImpl implements _$PixSchedulePayeeCWProxy {
  const _$PixSchedulePayeeCWProxyImpl(this._value);

  final PixSchedulePayee _value;

  @override
  PixSchedulePayee name(String name) => call(name: name);

  @override
  PixSchedulePayee documentMasked(String documentMasked) =>
      call(documentMasked: documentMasked);

  @override
  PixSchedulePayee keyType(PixSchedulePayeeKeyTypeEnum keyType) =>
      call(keyType: keyType);

  @override
  PixSchedulePayee keyMasked(String keyMasked) => call(keyMasked: keyMasked);

  @override
  PixSchedulePayee bank(PixPayeeBank? bank) => call(bank: bank);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixSchedulePayee(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixSchedulePayee(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixSchedulePayee call({
    Object? name = const $CopyWithPlaceholder(),
    Object? documentMasked = const $CopyWithPlaceholder(),
    Object? keyType = const $CopyWithPlaceholder(),
    Object? keyMasked = const $CopyWithPlaceholder(),
    Object? bank = const $CopyWithPlaceholder(),
  }) {
    return PixSchedulePayee(
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
          : keyType as PixSchedulePayeeKeyTypeEnum,
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

extension $PixSchedulePayeeCopyWith on PixSchedulePayee {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixSchedulePayee.copyWith(...)` or `instanceOfPixSchedulePayee.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixSchedulePayeeCWProxy get copyWith => _$PixSchedulePayeeCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixSchedulePayee _$PixSchedulePayeeFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PixSchedulePayee', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['name', 'documentMasked', 'keyType', 'keyMasked'],
      );
      final val = PixSchedulePayee(
        name: $checkedConvert('name', (v) => v as String),
        documentMasked: $checkedConvert('documentMasked', (v) => v as String),
        keyType: $checkedConvert(
          'keyType',
          (v) => $enumDecode(
            _$PixSchedulePayeeKeyTypeEnumEnumMap,
            v,
            unknownValue: PixSchedulePayeeKeyTypeEnum.unknownDefaultOpenApi,
          ),
        ),
        keyMasked: $checkedConvert('keyMasked', (v) => v as String),
        bank: $checkedConvert(
          'bank',
          (v) => v == null
              ? null
              : PixPayeeBank.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PixSchedulePayeeToJson(PixSchedulePayee instance) =>
    <String, dynamic>{
      'name': instance.name,
      'documentMasked': instance.documentMasked,
      'keyType': _$PixSchedulePayeeKeyTypeEnumEnumMap[instance.keyType]!,
      'keyMasked': instance.keyMasked,
      'bank': ?instance.bank?.toJson(),
    };

const _$PixSchedulePayeeKeyTypeEnumEnumMap = {
  PixSchedulePayeeKeyTypeEnum.CPF: 'CPF',
  PixSchedulePayeeKeyTypeEnum.EMAIL: 'EMAIL',
  PixSchedulePayeeKeyTypeEnum.PHONE: 'PHONE',
  PixSchedulePayeeKeyTypeEnum.RANDOM: 'RANDOM',
  PixSchedulePayeeKeyTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
