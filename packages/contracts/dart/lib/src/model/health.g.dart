// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$HealthCWProxy {
  Health status(HealthStatusEnum status);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Health(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Health(...).copyWith(id: 12, name: "My name")
  /// ```
  Health call({HealthStatusEnum status});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfHealth.copyWith(...)` or call `instanceOfHealth.copyWith.fieldName(value)` for a single field.
class _$HealthCWProxyImpl implements _$HealthCWProxy {
  const _$HealthCWProxyImpl(this._value);

  final Health _value;

  @override
  Health status(HealthStatusEnum status) => call(status: status);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Health(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Health(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  Health call({Object? status = const $CopyWithPlaceholder()}) {
    return Health(
      status: status == const $CopyWithPlaceholder() || status == null
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as HealthStatusEnum,
    );
  }
}

extension $HealthCopyWith on Health {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfHealth.copyWith(...)` or `instanceOfHealth.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$HealthCWProxy get copyWith => _$HealthCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Health _$HealthFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Health', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['status']);
      final val = Health(
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$HealthStatusEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$HealthToJson(Health instance) => <String, dynamic>{
  'status': _$HealthStatusEnumEnumMap[instance.status]!,
};

const _$HealthStatusEnumEnumMap = {HealthStatusEnum.ok: 'ok'};
