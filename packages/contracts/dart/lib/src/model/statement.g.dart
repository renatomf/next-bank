// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'statement.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StatementCWProxy {
  Statement items(List<StatementItem> items);

  Statement nextCursor(String? nextCursor);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Statement(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Statement(...).copyWith(id: 12, name: "My name")
  /// ```
  Statement call({List<StatementItem> items, String? nextCursor});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfStatement.copyWith(...)` or call `instanceOfStatement.copyWith.fieldName(value)` for a single field.
class _$StatementCWProxyImpl implements _$StatementCWProxy {
  const _$StatementCWProxyImpl(this._value);

  final Statement _value;

  @override
  Statement items(List<StatementItem> items) => call(items: items);

  @override
  Statement nextCursor(String? nextCursor) => call(nextCursor: nextCursor);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Statement(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Statement(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  Statement call({
    Object? items = const $CopyWithPlaceholder(),
    Object? nextCursor = const $CopyWithPlaceholder(),
  }) {
    return Statement(
      items: items == const $CopyWithPlaceholder() || items == null
          ? _value.items
          // ignore: cast_nullable_to_non_nullable
          : items as List<StatementItem>,
      nextCursor: nextCursor == const $CopyWithPlaceholder()
          ? _value.nextCursor
          // ignore: cast_nullable_to_non_nullable
          : nextCursor as String?,
    );
  }
}

extension $StatementCopyWith on Statement {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfStatement.copyWith(...)` or `instanceOfStatement.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StatementCWProxy get copyWith => _$StatementCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Statement _$StatementFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Statement', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['items', 'nextCursor']);
      final val = Statement(
        items: $checkedConvert(
          'items',
          (v) => (v as List<dynamic>)
              .map((e) => StatementItem.fromJson(e as Map<String, dynamic>))
              .toList(),
        ),
        nextCursor: $checkedConvert('nextCursor', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$StatementToJson(Statement instance) => <String, dynamic>{
  'items': instance.items.map((e) => e.toJson()).toList(),
  'nextCursor': instance.nextCursor,
};
