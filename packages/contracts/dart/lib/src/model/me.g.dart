// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'me.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MeCWProxy {
  Me name(String name);

  Me cpfMasked(String cpfMasked);

  Me hasPin(bool hasPin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Me(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Me(...).copyWith(id: 12, name: "My name")
  /// ```
  Me call({String name, String cpfMasked, bool hasPin});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfMe.copyWith(...)` or call `instanceOfMe.copyWith.fieldName(value)` for a single field.
class _$MeCWProxyImpl implements _$MeCWProxy {
  const _$MeCWProxyImpl(this._value);

  final Me _value;

  @override
  Me name(String name) => call(name: name);

  @override
  Me cpfMasked(String cpfMasked) => call(cpfMasked: cpfMasked);

  @override
  Me hasPin(bool hasPin) => call(hasPin: hasPin);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Me(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Me(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  Me call({
    Object? name = const $CopyWithPlaceholder(),
    Object? cpfMasked = const $CopyWithPlaceholder(),
    Object? hasPin = const $CopyWithPlaceholder(),
  }) {
    return Me(
      name: name == const $CopyWithPlaceholder() || name == null
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      cpfMasked: cpfMasked == const $CopyWithPlaceholder() || cpfMasked == null
          ? _value.cpfMasked
          // ignore: cast_nullable_to_non_nullable
          : cpfMasked as String,
      hasPin: hasPin == const $CopyWithPlaceholder() || hasPin == null
          ? _value.hasPin
          // ignore: cast_nullable_to_non_nullable
          : hasPin as bool,
    );
  }
}

extension $MeCopyWith on Me {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfMe.copyWith(...)` or `instanceOfMe.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MeCWProxy get copyWith => _$MeCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Me _$MeFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Me', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['name', 'cpfMasked', 'hasPin']);
      final val = Me(
        name: $checkedConvert('name', (v) => v as String),
        cpfMasked: $checkedConvert('cpfMasked', (v) => v as String),
        hasPin: $checkedConvert('hasPin', (v) => v as bool),
      );
      return val;
    });

Map<String, dynamic> _$MeToJson(Me instance) => <String, dynamic>{
  'name': instance.name,
  'cpfMasked': instance.cpfMasked,
  'hasPin': instance.hasPin,
};
