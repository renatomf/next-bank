// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_receiving_key.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixReceivingKeyCWProxy {
  PixReceivingKey key(String key);

  PixReceivingKey keyMasked(String keyMasked);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixReceivingKey(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixReceivingKey(...).copyWith(id: 12, name: "My name")
  /// ```
  PixReceivingKey call({String key, String keyMasked});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixReceivingKey.copyWith(...)` or call `instanceOfPixReceivingKey.copyWith.fieldName(value)` for a single field.
class _$PixReceivingKeyCWProxyImpl implements _$PixReceivingKeyCWProxy {
  const _$PixReceivingKeyCWProxyImpl(this._value);

  final PixReceivingKey _value;

  @override
  PixReceivingKey key(String key) => call(key: key);

  @override
  PixReceivingKey keyMasked(String keyMasked) => call(keyMasked: keyMasked);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixReceivingKey(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixReceivingKey(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixReceivingKey call({
    Object? key = const $CopyWithPlaceholder(),
    Object? keyMasked = const $CopyWithPlaceholder(),
  }) {
    return PixReceivingKey(
      key: key == const $CopyWithPlaceholder() || key == null
          ? _value.key
          // ignore: cast_nullable_to_non_nullable
          : key as String,
      keyMasked: keyMasked == const $CopyWithPlaceholder() || keyMasked == null
          ? _value.keyMasked
          // ignore: cast_nullable_to_non_nullable
          : keyMasked as String,
    );
  }
}

extension $PixReceivingKeyCopyWith on PixReceivingKey {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixReceivingKey.copyWith(...)` or `instanceOfPixReceivingKey.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixReceivingKeyCWProxy get copyWith => _$PixReceivingKeyCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixReceivingKey _$PixReceivingKeyFromJson(Map<String, dynamic> json) =>
    $checkedCreate('PixReceivingKey', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['key', 'keyMasked']);
      final val = PixReceivingKey(
        key: $checkedConvert('key', (v) => v as String),
        keyMasked: $checkedConvert('keyMasked', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$PixReceivingKeyToJson(PixReceivingKey instance) =>
    <String, dynamic>{'key': instance.key, 'keyMasked': instance.keyMasked};
