// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'money.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MoneyCWProxy {
  Money amount(int amount);

  Money currency(MoneyCurrencyEnum currency);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Money(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Money(...).copyWith(id: 12, name: "My name")
  /// ```
  Money call({int amount, MoneyCurrencyEnum currency});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfMoney.copyWith(...)` or call `instanceOfMoney.copyWith.fieldName(value)` for a single field.
class _$MoneyCWProxyImpl implements _$MoneyCWProxy {
  const _$MoneyCWProxyImpl(this._value);

  final Money _value;

  @override
  Money amount(int amount) => call(amount: amount);

  @override
  Money currency(MoneyCurrencyEnum currency) => call(currency: currency);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `Money(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// Money(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  Money call({
    Object? amount = const $CopyWithPlaceholder(),
    Object? currency = const $CopyWithPlaceholder(),
  }) {
    return Money(
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as int,
      currency: currency == const $CopyWithPlaceholder() || currency == null
          ? _value.currency
          // ignore: cast_nullable_to_non_nullable
          : currency as MoneyCurrencyEnum,
    );
  }
}

extension $MoneyCopyWith on Money {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfMoney.copyWith(...)` or `instanceOfMoney.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MoneyCWProxy get copyWith => _$MoneyCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Money _$MoneyFromJson(Map<String, dynamic> json) =>
    $checkedCreate('Money', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['amount', 'currency']);
      final val = Money(
        amount: $checkedConvert('amount', (v) => (v as num).toInt()),
        currency: $checkedConvert(
          'currency',
          (v) => $enumDecode(_$MoneyCurrencyEnumEnumMap, v),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MoneyToJson(Money instance) => <String, dynamic>{
  'amount': instance.amount,
  'currency': _$MoneyCurrencyEnumEnumMap[instance.currency]!,
};

const _$MoneyCurrencyEnumEnumMap = {MoneyCurrencyEnum.BRL: 'BRL'};
