// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'statement_counterparty.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StatementCounterpartyCWProxy {
  StatementCounterparty name(String name);

  StatementCounterparty documentMasked(String? documentMasked);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `StatementCounterparty(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// StatementCounterparty(...).copyWith(id: 12, name: "My name")
  /// ```
  StatementCounterparty call({String name, String? documentMasked});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfStatementCounterparty.copyWith(...)` or call `instanceOfStatementCounterparty.copyWith.fieldName(value)` for a single field.
class _$StatementCounterpartyCWProxyImpl
    implements _$StatementCounterpartyCWProxy {
  const _$StatementCounterpartyCWProxyImpl(this._value);

  final StatementCounterparty _value;

  @override
  StatementCounterparty name(String name) => call(name: name);

  @override
  StatementCounterparty documentMasked(String? documentMasked) =>
      call(documentMasked: documentMasked);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `StatementCounterparty(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// StatementCounterparty(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  StatementCounterparty call({
    Object? name = const $CopyWithPlaceholder(),
    Object? documentMasked = const $CopyWithPlaceholder(),
  }) {
    return StatementCounterparty(
      name: name == const $CopyWithPlaceholder() || name == null
          ? _value.name
          // ignore: cast_nullable_to_non_nullable
          : name as String,
      documentMasked: documentMasked == const $CopyWithPlaceholder()
          ? _value.documentMasked
          // ignore: cast_nullable_to_non_nullable
          : documentMasked as String?,
    );
  }
}

extension $StatementCounterpartyCopyWith on StatementCounterparty {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfStatementCounterparty.copyWith(...)` or `instanceOfStatementCounterparty.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StatementCounterpartyCWProxy get copyWith =>
      _$StatementCounterpartyCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StatementCounterparty _$StatementCounterpartyFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('StatementCounterparty', json, ($checkedConvert) {
  $checkKeys(json, requiredKeys: const ['name', 'documentMasked']);
  final val = StatementCounterparty(
    name: $checkedConvert('name', (v) => v as String),
    documentMasked: $checkedConvert('documentMasked', (v) => v as String?),
  );
  return val;
});

Map<String, dynamic> _$StatementCounterpartyToJson(
  StatementCounterparty instance,
) => <String, dynamic>{
  'name': instance.name,
  'documentMasked': instance.documentMasked,
};
