// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'money_input.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MoneyInputCWProxy {
  MoneyInput amount(int amount);

  MoneyInput currency(MoneyInputCurrencyEnum currency);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `MoneyInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// MoneyInput(...).copyWith(id: 12, name: "My name")
  /// ```
  MoneyInput call({int amount, MoneyInputCurrencyEnum currency});
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfMoneyInput.copyWith(...)` or call `instanceOfMoneyInput.copyWith.fieldName(value)` for a single field.
class _$MoneyInputCWProxyImpl implements _$MoneyInputCWProxy {
  const _$MoneyInputCWProxyImpl(this._value);

  final MoneyInput _value;

  @override
  MoneyInput amount(int amount) => call(amount: amount);

  @override
  MoneyInput currency(MoneyInputCurrencyEnum currency) =>
      call(currency: currency);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `MoneyInput(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// MoneyInput(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  MoneyInput call({
    Object? amount = const $CopyWithPlaceholder(),
    Object? currency = const $CopyWithPlaceholder(),
  }) {
    return MoneyInput(
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as int,
      currency: currency == const $CopyWithPlaceholder() || currency == null
          ? _value.currency
          // ignore: cast_nullable_to_non_nullable
          : currency as MoneyInputCurrencyEnum,
    );
  }
}

extension $MoneyInputCopyWith on MoneyInput {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfMoneyInput.copyWith(...)` or `instanceOfMoneyInput.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MoneyInputCWProxy get copyWith => _$MoneyInputCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MoneyInput _$MoneyInputFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MoneyInput', json, ($checkedConvert) {
      $checkKeys(json, requiredKeys: const ['amount', 'currency']);
      final val = MoneyInput(
        amount: $checkedConvert('amount', (v) => (v as num).toInt()),
        currency: $checkedConvert(
          'currency',
          (v) => $enumDecode(
            _$MoneyInputCurrencyEnumEnumMap,
            v,
            unknownValue: MoneyInputCurrencyEnum.unknownDefaultOpenApi,
          ),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MoneyInputToJson(MoneyInput instance) =>
    <String, dynamic>{
      'amount': instance.amount,
      'currency': _$MoneyInputCurrencyEnumEnumMap[instance.currency]!,
    };

const _$MoneyInputCurrencyEnumEnumMap = {
  MoneyInputCurrencyEnum.BRL: 'BRL',
  MoneyInputCurrencyEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};
