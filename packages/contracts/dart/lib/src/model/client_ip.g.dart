// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'client_ip.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ClientIpCWProxy {
  ClientIp ip(String ip);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ClientIp(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ClientIp(...).copyWith(id: 12, name: "My name")
  /// ```
  ClientIp call({String ip});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfClientIp.copyWith(...)` or call `instanceOfClientIp.copyWith.fieldName(value)` for a single field.
class _$ClientIpCWProxyImpl implements _$ClientIpCWProxy {
  const _$ClientIpCWProxyImpl(this._value);

  final ClientIp _value;

  @override
  ClientIp ip(String ip) => call(ip: ip);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ClientIp(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ClientIp(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  ClientIp call({Object? ip = const $CopyWithPlaceholder()}) {
    return ClientIp(
      ip: ip == const $CopyWithPlaceholder() || ip == null
          ? _value.ip
          // ignore: cast_nullable_to_non_nullable
          : ip as String,
    );
  }
}

extension $ClientIpCopyWith on ClientIp {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfClientIp.copyWith(...)` or `instanceOfClientIp.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ClientIpCWProxy get copyWith => _$ClientIpCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ClientIp _$ClientIpFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ClientIp', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['ip']);
      final val = ClientIp(ip: $checkedConvert('ip', (v) => v as String));
      return val;
    });

Map<String, dynamic> _$ClientIpToJson(ClientIp instance) => <String, dynamic>{
  'ip': instance.ip,
};
