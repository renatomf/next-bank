// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_key_lookup.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixKeyLookupCWProxy {
  PixKeyLookup keyType(PixKeyLookupKeyTypeEnum keyType);

  PixKeyLookup keyMasked(String keyMasked);

  PixKeyLookup payeeName(String payeeName);

  PixKeyLookup payeeDocumentMasked(String payeeDocumentMasked);

  PixKeyLookup bank(PixPayeeBank? bank);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixKeyLookup(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixKeyLookup(...).copyWith(id: 12, name: "My name")
  /// ```
  PixKeyLookup call({
    PixKeyLookupKeyTypeEnum keyType,
    String keyMasked,
    String payeeName,
    String payeeDocumentMasked,
    PixPayeeBank? bank,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixKeyLookup.copyWith(...)` or call `instanceOfPixKeyLookup.copyWith.fieldName(value)` for a single field.
class _$PixKeyLookupCWProxyImpl implements _$PixKeyLookupCWProxy {
  const _$PixKeyLookupCWProxyImpl(this._value);

  final PixKeyLookup _value;

  @override
  PixKeyLookup keyType(PixKeyLookupKeyTypeEnum keyType) =>
      call(keyType: keyType);

  @override
  PixKeyLookup keyMasked(String keyMasked) => call(keyMasked: keyMasked);

  @override
  PixKeyLookup payeeName(String payeeName) => call(payeeName: payeeName);

  @override
  PixKeyLookup payeeDocumentMasked(String payeeDocumentMasked) =>
      call(payeeDocumentMasked: payeeDocumentMasked);

  @override
  PixKeyLookup bank(PixPayeeBank? bank) => call(bank: bank);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixKeyLookup(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixKeyLookup(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixKeyLookup call({
    Object? keyType = const $CopyWithPlaceholder(),
    Object? keyMasked = const $CopyWithPlaceholder(),
    Object? payeeName = const $CopyWithPlaceholder(),
    Object? payeeDocumentMasked = const $CopyWithPlaceholder(),
    Object? bank = const $CopyWithPlaceholder(),
  }) {
    return PixKeyLookup(
      keyType: keyType == const $CopyWithPlaceholder() || keyType == null
          ? _value.keyType
          // ignore: cast_nullable_to_non_nullable
          : keyType as PixKeyLookupKeyTypeEnum,
      keyMasked: keyMasked == const $CopyWithPlaceholder() || keyMasked == null
          ? _value.keyMasked
          // ignore: cast_nullable_to_non_nullable
          : keyMasked as String,
      payeeName: payeeName == const $CopyWithPlaceholder() || payeeName == null
          ? _value.payeeName
          // ignore: cast_nullable_to_non_nullable
          : payeeName as String,
      payeeDocumentMasked:
          payeeDocumentMasked == const $CopyWithPlaceholder() ||
              payeeDocumentMasked == null
          ? _value.payeeDocumentMasked
          // ignore: cast_nullable_to_non_nullable
          : payeeDocumentMasked as String,
      bank: bank == const $CopyWithPlaceholder()
          ? _value.bank
          // ignore: cast_nullable_to_non_nullable
          : bank as PixPayeeBank?,
    );
  }
}

extension $PixKeyLookupCopyWith on PixKeyLookup {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixKeyLookup.copyWith(...)` or `instanceOfPixKeyLookup.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixKeyLookupCWProxy get copyWith => _$PixKeyLookupCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixKeyLookup _$PixKeyLookupFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PixKeyLookup', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'keyType',
          'keyMasked',
          'payeeName',
          'payeeDocumentMasked',
        ],
      );
      final val = PixKeyLookup(
        keyType: $checkedConvert(
          'keyType',
          (v) => $enumDecode(
            _$PixKeyLookupKeyTypeEnumEnumMap,
            v,
            unknownValue: PixKeyLookupKeyTypeEnum.unknownDefaultOpenApi,
          ),
        ),
        keyMasked: $checkedConvert('keyMasked', (v) => v as String),
        payeeName: $checkedConvert('payeeName', (v) => v as String),
        payeeDocumentMasked: $checkedConvert(
          'payeeDocumentMasked',
          (v) => v as String,
        ),
        bank: $checkedConvert(
          'bank',
          (v) => v == null
              ? null
              : PixPayeeBank.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$PixKeyLookupToJson(PixKeyLookup instance) =>
    <String, dynamic>{
      'keyType': _$PixKeyLookupKeyTypeEnumEnumMap[instance.keyType]!,
      'keyMasked': instance.keyMasked,
      'payeeName': instance.payeeName,
      'payeeDocumentMasked': instance.payeeDocumentMasked,
      'bank': ?instance.bank?.toJson(),
    };

const _$PixKeyLookupKeyTypeEnumEnumMap = {
  PixKeyLookupKeyTypeEnum.CPF: 'CPF',
  PixKeyLookupKeyTypeEnum.EMAIL: 'EMAIL',
  PixKeyLookupKeyTypeEnum.PHONE: 'PHONE',
  PixKeyLookupKeyTypeEnum.RANDOM: 'RANDOM',
  PixKeyLookupKeyTypeEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
