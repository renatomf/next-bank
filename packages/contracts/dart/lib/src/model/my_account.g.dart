// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'my_account.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$MyAccountCWProxy {
  MyAccount branch(String branch);

  MyAccount number(String number);

  MyAccount status(MyAccountStatusEnum status);

  MyAccount availableBalance(Money availableBalance);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `MyAccount(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// MyAccount(...).copyWith(id: 12, name: "My name")
  /// ```
  MyAccount call({
    String branch,
    String number,
    MyAccountStatusEnum status,
    Money availableBalance,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfMyAccount.copyWith(...)` or call `instanceOfMyAccount.copyWith.fieldName(value)` for a single field.
class _$MyAccountCWProxyImpl implements _$MyAccountCWProxy {
  const _$MyAccountCWProxyImpl(this._value);

  final MyAccount _value;

  @override
  MyAccount branch(String branch) => call(branch: branch);

  @override
  MyAccount number(String number) => call(number: number);

  @override
  MyAccount status(MyAccountStatusEnum status) => call(status: status);

  @override
  MyAccount availableBalance(Money availableBalance) =>
      call(availableBalance: availableBalance);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `MyAccount(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// MyAccount(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  MyAccount call({
    Object? branch = const $CopyWithPlaceholder(),
    Object? number = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? availableBalance = const $CopyWithPlaceholder(),
  }) {
    return MyAccount(
      branch: branch == const $CopyWithPlaceholder() || branch == null
          ? _value.branch
          // ignore: cast_nullable_to_non_nullable
          : branch as String,
      number: number == const $CopyWithPlaceholder() || number == null
          ? _value.number
          // ignore: cast_nullable_to_non_nullable
          : number as String,
      status: status == const $CopyWithPlaceholder() || status == null
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as MyAccountStatusEnum,
      availableBalance:
          availableBalance == const $CopyWithPlaceholder() ||
              availableBalance == null
          ? _value.availableBalance
          // ignore: cast_nullable_to_non_nullable
          : availableBalance as Money,
    );
  }
}

extension $MyAccountCopyWith on MyAccount {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfMyAccount.copyWith(...)` or `instanceOfMyAccount.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$MyAccountCWProxy get copyWith => _$MyAccountCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

MyAccount _$MyAccountFromJson(Map<String, dynamic> json) =>
    $checkedCreate('MyAccount', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const ['branch', 'number', 'status', 'availableBalance'],
      );
      final val = MyAccount(
        branch: $checkedConvert('branch', (v) => v as String),
        number: $checkedConvert('number', (v) => v as String),
        status: $checkedConvert(
          'status',
          (v) => $enumDecode(_$MyAccountStatusEnumEnumMap, v),
        ),
        availableBalance: $checkedConvert(
          'availableBalance',
          (v) => Money.fromJson(v as Map<String, dynamic>),
        ),
      );
      return val;
    });

Map<String, dynamic> _$MyAccountToJson(MyAccount instance) => <String, dynamic>{
  'branch': instance.branch,
  'number': instance.number,
  'status': _$MyAccountStatusEnumEnumMap[instance.status]!,
  'availableBalance': instance.availableBalance.toJson(),
};

const _$MyAccountStatusEnumEnumMap = {
  MyAccountStatusEnum.ACTIVE: 'ACTIVE',
  MyAccountStatusEnum.BLOCKED: 'BLOCKED',
  MyAccountStatusEnum.CLOSED: 'CLOSED',
};
