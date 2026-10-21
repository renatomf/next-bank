// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'top_up_operator_list.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TopUpOperatorListCWProxy {
  TopUpOperatorList operators(List<TopUpOperatorListOperatorsInner> operators);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `TopUpOperatorList(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// TopUpOperatorList(...).copyWith(id: 12, name: "My name")
  /// ```
  TopUpOperatorList call({List<TopUpOperatorListOperatorsInner> operators});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfTopUpOperatorList.copyWith(...)` or call `instanceOfTopUpOperatorList.copyWith.fieldName(value)` for a single field.
class _$TopUpOperatorListCWProxyImpl implements _$TopUpOperatorListCWProxy {
  const _$TopUpOperatorListCWProxyImpl(this._value);

  final TopUpOperatorList _value;

  @override
  TopUpOperatorList operators(
    List<TopUpOperatorListOperatorsInner> operators,
  ) => call(operators: operators);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `TopUpOperatorList(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// TopUpOperatorList(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  TopUpOperatorList call({Object? operators = const $CopyWithPlaceholder()}) {
    return TopUpOperatorList(
      operators: operators == const $CopyWithPlaceholder() || operators == null
          ? _value.operators
          // ignore: cast_nullable_to_non_nullable
          : operators as List<TopUpOperatorListOperatorsInner>,
    );
  }
}

extension $TopUpOperatorListCopyWith on TopUpOperatorList {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfTopUpOperatorList.copyWith(...)` or `instanceOfTopUpOperatorList.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TopUpOperatorListCWProxy get copyWith =>
      _$TopUpOperatorListCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TopUpOperatorList _$TopUpOperatorListFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TopUpOperatorList', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['operators']);
      final val = TopUpOperatorList(
        operators: $checkedConvert(
          'operators',
          (v) => (v as List<dynamic>)
              .map(
                (e) => TopUpOperatorListOperatorsInner.fromJson(
                  e as Map<String, dynamic>,
                ),
              )
              .toList(),
        ),
      );
      return val;
    });

Map<String, dynamic> _$TopUpOperatorListToJson(TopUpOperatorList instance) =>
    <String, dynamic>{
      'operators': instance.operators.map((e) => e.toJson()).toList(),
    };
