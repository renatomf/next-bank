// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'session_list.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$SessionListCWProxy {
  SessionList items(List<ActiveSession> items);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `SessionList(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// SessionList(...).copyWith(id: 12, name: "My name")
  /// ```
  SessionList call({List<ActiveSession> items});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfSessionList.copyWith(...)` or call `instanceOfSessionList.copyWith.fieldName(value)` for a single field.
class _$SessionListCWProxyImpl implements _$SessionListCWProxy {
  const _$SessionListCWProxyImpl(this._value);

  final SessionList _value;

  @override
  SessionList items(List<ActiveSession> items) => call(items: items);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `SessionList(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// SessionList(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  SessionList call({Object? items = const $CopyWithPlaceholder()}) {
    return SessionList(
      items: items == const $CopyWithPlaceholder() || items == null
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<ActiveSession>,
    );
  }
}

extension $SessionListCopyWith on SessionList {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfSessionList.copyWith(...)` or `instanceOfSessionList.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$SessionListCWProxy get copyWith => _$SessionListCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SessionList _$SessionListFromJson(Map<String, dynamic> json) =>
    $checkedCreate('SessionList', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items']);
      final val = SessionList(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => ActiveSession.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$SessionListToJson(SessionList instance) =>
    <String, dynamic>{'items': instance.items.map((e) => e.toJson()).toList()};
