// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'top_up_operator.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TopUpOperatorCWProxy {
  TopUpOperator id(String id);

  TopUpOperator name(String name);

  TopUpOperator initials(String initials);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `TopUpOperator(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// TopUpOperator(...).copyWith(id: 12, name: "My name")
  /// ```
  TopUpOperator call({String id, String name, String initials});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfTopUpOperator.copyWith(...)` or call `instanceOfTopUpOperator.copyWith.fieldName(value)` for a single field.
class _$TopUpOperatorCWProxyImpl implements _$TopUpOperatorCWProxy {
  const _$TopUpOperatorCWProxyImpl(this._value);

  final TopUpOperator _value;

  @override
  TopUpOperator id(String id) => call(id: id);

  @override
  TopUpOperator name(String name) => call(name: name);

  @override
  TopUpOperator initials(String initials) => call(initials: initials);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `TopUpOperator(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// TopUpOperator(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  TopUpOperator call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? initials = const $CopyWithPlaceholder(),
  }) {
    return TopUpOperator(
      id: id == const $CopyWithPlaceholder() || id == null
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      name: name == const $CopyWithPlaceholder() || name == null
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      initials: initials == const $CopyWithPlaceholder() || initials == null
          ? _value.initials
          // ignore: cast_nullable_to_non_nullable
          : initials as String,
    );
  }
}

extension $TopUpOperatorCopyWith on TopUpOperator {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfTopUpOperator.copyWith(...)` or `instanceOfTopUpOperator.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TopUpOperatorCWProxy get copyWith => _$TopUpOperatorCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TopUpOperator _$TopUpOperatorFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TopUpOperator', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['id', 'name', 'initials']);
      final val = TopUpOperator(
        id: $checkedConvert('id', (v) => v as String),
        name: $checkedConvert('name', (v) => v as String),
        initials: $checkedConvert('initials', (v) => v as String),
      );
      return val;
    });

Map<String, dynamic> _$TopUpOperatorToJson(TopUpOperator instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'initials': instance.initials,
    };
