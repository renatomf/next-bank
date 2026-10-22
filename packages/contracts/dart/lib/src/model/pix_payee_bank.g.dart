// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_payee_bank.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixPayeeBankCWProxy {
  PixPayeeBank ispb(String ispb);

  PixPayeeBank name(String name);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixPayeeBank(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixPayeeBank(...).copyWith(id: 12, name: "My name")
  /// ```
  PixPayeeBank call({String ispb, String name});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixPayeeBank.copyWith(...)` or call `instanceOfPixPayeeBank.copyWith.fieldName(value)` for a single field.
class _$PixPayeeBankCWProxyImpl implements _$PixPayeeBankCWProxy {
  const _$PixPayeeBankCWProxyImpl(this._value);

  final PixPayeeBank _value;

  @override
  PixPayeeBank ispb(String ispb) => call(ispb: ispb);

  @override
  PixPayeeBank name(String name) => call(name: name);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixPayeeBank(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixPayeeBank(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixPayeeBank call({
    Object? ispb = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
  }) {
    return PixPayeeBank(
      ispb: ispb == const $CopyWithPlaceholder() || ispb == null
          ? _value.ispb
          // ignore: cast_nullable_to_non_nullable
          : ispb as String,
      name: name == const $CopyWithPlaceholder() || name == null
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
    );
  }
}

extension $PixPayeeBankCopyWith on PixPayeeBank {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixPayeeBank.copyWith(...)` or `instanceOfPixPayeeBank.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixPayeeBankCWProxy get copyWith => _$PixPayeeBankCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixPayeeBank _$PixPayeeBankFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PixPayeeBank', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['ispb', 'name']);
      final val = PixPayeeBank(
        ispb: $checkedConvert('ispb', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PixPayeeBankToJson(PixPayeeBank instance) =>
    <String, dynamic>{'ispb': instance.ispb, 'name': instance.name};
