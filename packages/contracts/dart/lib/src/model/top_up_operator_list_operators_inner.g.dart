// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'top_up_operator_list_operators_inner.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TopUpOperatorListOperatorsInnerCWProxy {
  TopUpOperatorListOperatorsInner id(String id);

  TopUpOperatorListOperatorsInner name(String name);

  TopUpOperatorListOperatorsInner initials(String initials);

  TopUpOperatorListOperatorsInner amounts(List<Money> amounts);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `TopUpOperatorListOperatorsInner(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// TopUpOperatorListOperatorsInner(...).copyWith(id: 12, name: "My name")
  /// ```
  TopUpOperatorListOperatorsInner call({
    String id,
    String name,
    String initials,
    List<Money> amounts,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfTopUpOperatorListOperatorsInner.copyWith(...)` or call `instanceOfTopUpOperatorListOperatorsInner.copyWith.fieldName(value)` for a single field.
class _$TopUpOperatorListOperatorsInnerCWProxyImpl
    implements _$TopUpOperatorListOperatorsInnerCWProxy {
  const _$TopUpOperatorListOperatorsInnerCWProxyImpl(this._value);

  final TopUpOperatorListOperatorsInner _value;

  @override
  TopUpOperatorListOperatorsInner id(String id) => call(id: id);

  @override
  TopUpOperatorListOperatorsInner name(String name) => call(name: name);

  @override
  TopUpOperatorListOperatorsInner initials(String initials) =>
      call(initials: initials);

  @override
  TopUpOperatorListOperatorsInner amounts(List<Money> amounts) =>
      call(amounts: amounts);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `TopUpOperatorListOperatorsInner(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// TopUpOperatorListOperatorsInner(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  TopUpOperatorListOperatorsInner call({
    Object? id = const $CopyWithPlaceholder(),
    Object? name = const $CopyWithPlaceholder(),
    Object? initials = const $CopyWithPlaceholder(),
    Object? amounts = const $CopyWithPlaceholder(),
  }) {
    return TopUpOperatorListOperatorsInner(
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
      amounts: amounts == const $CopyWithPlaceholder() || amounts == null
          ? _value.amounts
          // ignore: cast_nullable_to_non_nullable
          : amounts as List<Money>,
    );
  }
}

extension $TopUpOperatorListOperatorsInnerCopyWith
    on TopUpOperatorListOperatorsInner {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfTopUpOperatorListOperatorsInner.copyWith(...)` or `instanceOfTopUpOperatorListOperatorsInner.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TopUpOperatorListOperatorsInnerCWProxy get copyWith =>
      _$TopUpOperatorListOperatorsInnerCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TopUpOperatorListOperatorsInner _$TopUpOperatorListOperatorsInnerFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('TopUpOperatorListOperatorsInner', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['id', 'name', 'initials', 'amounts']);
  final val = TopUpOperatorListOperatorsInner(
    id: $checkedConvert('id', (v) => v as String),
    name: $checkedConvert('name', (v) => v as String),
    initials: $checkedConvert('initials', (v) => v as String),
    amounts: $checkedConvert(
      'amounts',
      (v) => (v as List<dynamic>)
          .map((e) => Money.fromJson(e as Map<String, dynamic>))
          .toList(),
    ),
  );
  return val;
});

Map<String, dynamic> _$TopUpOperatorListOperatorsInnerToJson(
  TopUpOperatorListOperatorsInner instance,
) => <String, dynamic>{
  'id': instance.id,
  'name': instance.name,
  'initials': instance.initials,
  'amounts': instance.amounts.map((e) => e.toJson()).toList(),
};
