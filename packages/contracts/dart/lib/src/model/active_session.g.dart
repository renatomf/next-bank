// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'active_session.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$ActiveSessionCWProxy {
  ActiveSession id(String id);

  ActiveSession deviceLabel(String? deviceLabel);

  ActiveSession createdAt(DateTime createdAt);

  ActiveSession lastUsedAt(DateTime lastUsedAt);

  ActiveSession current(bool current);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ActiveSession(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ActiveSession(...).copyWith(id: 12, name: "My name")
  /// ```
  ActiveSession call({
    String id,
    String? deviceLabel,
    DateTime createdAt,
    DateTime lastUsedAt,
    bool current,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfActiveSession.copyWith(...)` or call `instanceOfActiveSession.copyWith.fieldName(value)` for a single field.
class _$ActiveSessionCWProxyImpl implements _$ActiveSessionCWProxy {
  const _$ActiveSessionCWProxyImpl(this._value);

  final ActiveSession _value;

  @override
  ActiveSession id(String id) => call(id: id);

  @override
  ActiveSession deviceLabel(String? deviceLabel) =>
      call(deviceLabel: deviceLabel);

  @override
  ActiveSession createdAt(DateTime createdAt) => call(createdAt: createdAt);

  @override
  ActiveSession lastUsedAt(DateTime lastUsedAt) => call(lastUsedAt: lastUsedAt);

  @override
  ActiveSession current(bool current) => call(current: current);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `ActiveSession(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// ActiveSession(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  ActiveSession call({
    Object? id = const $CopyWithPlaceholder(),
    Object? deviceLabel = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? lastUsedAt = const $CopyWithPlaceholder(),
    Object? current = const $CopyWithPlaceholder(),
  }) {
    return ActiveSession(
      id: id == const $CopyWithPlaceholder() || id == null
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      deviceLabel: deviceLabel == const $CopyWithPlaceholder()
          ? _value.deviceLabel
          // ignore: cast_nullable_to_non_nullable
          : deviceLabel as String?,
      createdAt: createdAt == const $CopyWithPlaceholder() || createdAt == null
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      lastUsedAt:
          lastUsedAt == const $CopyWithPlaceholder() || lastUsedAt == null
          ? _value.lastUsedAt
          // ignore: cast_nullable_to_non_nullable
          : lastUsedAt as DateTime,
      current: current == const $CopyWithPlaceholder() || current == null
          ? _value.current
          // ignore: cast_nullable_to_non_nullable
          : current as bool,
    );
  }
}

extension $ActiveSessionCopyWith on ActiveSession {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfActiveSession.copyWith(...)` or `instanceOfActiveSession.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$ActiveSessionCWProxy get copyWith => _$ActiveSessionCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ActiveSession _$ActiveSessionFromJson(Map<String, dynamic> json) =>
    $checkedCreate('ActiveSession', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'deviceLabel',
          'createdAt',
          'lastUsedAt',
          'current',
        ],
      );
      final val = ActiveSession(
        id: $checkedConvert('id', (v) => v as String),
        deviceLabel: $checkedConvert('deviceLabel', (v) => v as String?),
        createdAt: $checkedConvert(
          'createdAt',
          (v) => DateTime.parse(v as String),
        ),
        lastUsedAt: $checkedConvert(
          'lastUsedAt',
          (v) => DateTime.parse(v as String),
        ),
        current: $checkedConvert('current', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$ActiveSessionToJson(ActiveSession instance) =>
    <String, dynamic>{
      'id': instance.id,
      'deviceLabel': instance.deviceLabel,
      'createdAt': instance.createdAt.toIso8601String(),
      'lastUsedAt': instance.lastUsedAt.toIso8601String(),
      'current': instance.current,
    };
