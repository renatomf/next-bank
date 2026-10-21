// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'top_up.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$TopUpCWProxy {
  TopUp id(String id);

  TopUp operator_(TopUpOperator operator_);

  TopUp phoneMasked(String phoneMasked);

  TopUp amount(Money amount);

  TopUp status(TopUpStatusEnum status);

  TopUp createdAt(DateTime createdAt);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `TopUp(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// TopUp(...).copyWith(id: 12, name: "My name")
  /// ```
  TopUp call({
    String id,
    TopUpOperator operator_,
    String phoneMasked,
    Money amount,
    TopUpStatusEnum status,
    DateTime createdAt,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfTopUp.copyWith(...)` or call `instanceOfTopUp.copyWith.fieldName(value)` for a single field.
class _$TopUpCWProxyImpl implements _$TopUpCWProxy {
  const _$TopUpCWProxyImpl(this._value);

  final TopUp _value;

  @override
  TopUp id(String id) => call(id: id);

  @override
  TopUp operator_(TopUpOperator operator_) => call(operator_: operator_);

  @override
  TopUp phoneMasked(String phoneMasked) => call(phoneMasked: phoneMasked);

  @override
  TopUp amount(Money amount) => call(amount: amount);

  @override
  TopUp status(TopUpStatusEnum status) => call(status: status);

  @override
  TopUp createdAt(DateTime createdAt) => call(createdAt: createdAt);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `TopUp(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// TopUp(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  TopUp call({
    Object? id = const $CopyWithPlaceholder(),
    Object? operator_ = const $CopyWithPlaceholder(),
    Object? phoneMasked = const $CopyWithPlaceholder(),
    Object? amount = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
  }) {
    return TopUp(
      id: id == const $CopyWithPlaceholder() || id == null
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      operator_: operator_ == const $CopyWithPlaceholder() || operator_ == null
          ? _value.operator_
          // ignore: cast_nullable_to_non_nullable
          : operator_ as TopUpOperator,
      phoneMasked:
          phoneMasked == const $CopyWithPlaceholder() || phoneMasked == null
          ? _value.phoneMasked
          // ignore: cast_nullable_to_non_nullable
          : phoneMasked as String,
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as Money,
      status: status == const $CopyWithPlaceholder() || status == null
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as TopUpStatusEnum,
      createdAt: createdAt == const $CopyWithPlaceholder() || createdAt == null
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
    );
  }
}

extension $TopUpCopyWith on TopUp {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfTopUp.copyWith(...)` or `instanceOfTopUp.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$TopUpCWProxy get copyWith => _$TopUpCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TopUp _$TopUpFromJson(Map<String, dynamic> json) =>
    $checkedCreate('TopUp', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'operator',
          'phoneMasked',
          'amount',
          'status',
          'createdAt',
        ],
      );
      final val = TopUp(
        id: $checkedConvert('id', (v) => v as String),
        operator_: $checkedConvert(
          'operator',
          (v) => TopUpOperator.fromJson(v as Map<String, dynamic>),
        ),
        phoneMasked: $checkedConvert('phoneMasked', (v) => v as String),
        amount: $checkedConvert(
          'amount',
          (v) => Money.fromJson(v as Map<String, dynamic>),
        ),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$TopUpStatusEnumEnumMap, v),
        ),
        createdAt: $checkedConvert(
          'createdAt',
          (v) => DateTime.parse(v as String),
        ),
      );
      return val;
    }, fieldKeyMap: const {'operator_': 'operator'});

Map<String, dynamic> _$TopUpToJson(TopUp instance) => <String, dynamic>{
  'id': instance.id,
  'operator': instance.operator_.toJson(),
  'phoneMasked': instance.phoneMasked,
  'amount': instance.amount.toJson(),
  'status': _$TopUpStatusEnumEnumMap[instance.status]!,
  'createdAt': instance.createdAt.toIso8601String(),
};

const _$TopUpStatusEnumEnumMap = {TopUpStatusEnum.COMPLETED: 'COMPLETED'};
