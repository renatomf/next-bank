// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'statement_item.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$StatementItemCWProxy {
  StatementItem id(String id);

  StatementItem occurredAt(DateTime occurredAt);

  StatementItem kind(StatementItemKindEnum kind);

  StatementItem direction(StatementItemDirectionEnum direction);

  StatementItem amount(Money amount);

  StatementItem counterparty(StatementCounterparty? counterparty);

  StatementItem transferId(String? transferId);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `StatementItem(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// StatementItem(...).copyWith(id: 12, name: "My name")
  /// ```
  StatementItem call({
    String id,
    DateTime occurredAt,
    StatementItemKindEnum kind,
    StatementItemDirectionEnum direction,
    Money amount,
    StatementCounterparty? counterparty,
    String? transferId,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfStatementItem.copyWith(...)` or call `instanceOfStatementItem.copyWith.fieldName(value)` for a single field.
class _$StatementItemCWProxyImpl implements _$StatementItemCWProxy {
  const _$StatementItemCWProxyImpl(this._value);

  final StatementItem _value;

  @override
  StatementItem id(String id) => call(id: id);

  @override
  StatementItem occurredAt(DateTime occurredAt) => call(occurredAt: occurredAt);

  @override
  StatementItem kind(StatementItemKindEnum kind) => call(kind: kind);

  @override
  StatementItem direction(StatementItemDirectionEnum direction) =>
      call(direction: direction);

  @override
  StatementItem amount(Money amount) => call(amount: amount);

  @override
  StatementItem counterparty(StatementCounterparty? counterparty) =>
      call(counterparty: counterparty);

  @override
  StatementItem transferId(String? transferId) => call(transferId: transferId);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `StatementItem(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// StatementItem(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  StatementItem call({
    Object? id = const $CopyWithPlaceholder(),
    Object? occurredAt = const $CopyWithPlaceholder(),
    Object? kind = const $CopyWithPlaceholder(),
    Object? direction = const $CopyWithPlaceholder(),
    Object? amount = const $CopyWithPlaceholder(),
    Object? counterparty = const $CopyWithPlaceholder(),
    Object? transferId = const $CopyWithPlaceholder(),
  }) {
    return StatementItem(
      id: id == const $CopyWithPlaceholder() || id == null
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      occurredAt:
          occurredAt == const $CopyWithPlaceholder() || occurredAt == null
          ? _value.occurredAt
          // ignore: cast_nullable_to_non_nullable
          : occurredAt as DateTime,
      kind: kind == const $CopyWithPlaceholder() || kind == null
          ? _value.kind
          // ignore: cast_nullable_to_non_nullable
          : kind as StatementItemKindEnum,
      direction: direction == const $CopyWithPlaceholder() || direction == null
          ? _value.direction
          // ignore: cast_nullable_to_non_nullable
          : direction as StatementItemDirectionEnum,
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as Money,
      counterparty: counterparty == const $CopyWithPlaceholder()
          ? _value.counterparty
          // ignore: cast_nullable_to_non_nullable
          : counterparty as StatementCounterparty?,
      transferId: transferId == const $CopyWithPlaceholder()
          ? _value.transferId
          // ignore: cast_nullable_to_non_nullable
          : transferId as String?,
    );
  }
}

extension $StatementItemCopyWith on StatementItem {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfStatementItem.copyWith(...)` or `instanceOfStatementItem.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$StatementItemCWProxy get copyWith => _$StatementItemCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

StatementItem _$StatementItemFromJson(Map<String, dynamic> json) =>
    $checkedCreate('StatementItem', json, ($checkedConvert) {
      $checkKeys(
        json,
        requiredKeys: const [
          'id',
          'occurredAt',
          'kind',
          'direction',
          'amount',
          'counterparty',
          'transferId',
        ],
      );
      final val = StatementItem(
        id: $checkedConvert('id', (v) => v as String),
        occurredAt: $checkedConvert(
          'occurredAt',
          (v) => DateTime.parse(v as String),
        ),
        kind: $checkedConvert(
          'kind',
          (v) => $enumDecode(_$StatementItemKindEnumEnumMap, v),
        ),
        direction: $checkedConvert(
          'direction',
          (v) => $enumDecode(_$StatementItemDirectionEnumEnumMap, v),
        ),
        amount: $checkedConvert(
          'amount',
          (v) => Money.fromJson(v as Map<String, dynamic>),
        ),
        counterparty: $checkedConvert(
          'counterparty',
          (v) => v == null
              ? null
              : StatementCounterparty.fromJson(v as Map<String, dynamic>),
        ),
        transferId: $checkedConvert('transferId', (v) => v as String?),
      );
      return val;
    });

Map<String, dynamic> _$StatementItemToJson(StatementItem instance) =>
    <String, dynamic>{
      'id': instance.id,
      'occurredAt': instance.occurredAt.toIso8601String(),
      'kind': _$StatementItemKindEnumEnumMap[instance.kind]!,
      'direction': _$StatementItemDirectionEnumEnumMap[instance.direction]!,
      'amount': instance.amount.toJson(),
      'counterparty': instance.counterparty?.toJson(),
      'transferId': instance.transferId,
    };

const _$StatementItemKindEnumEnumMap = {
  StatementItemKindEnum.PIX_SENT: 'PIX_SENT',
  StatementItemKindEnum.PIX_RECEIVED: 'PIX_RECEIVED',
  StatementItemKindEnum.DEMO_FUNDING: 'DEMO_FUNDING',
};

const _$StatementItemDirectionEnumEnumMap = {
  StatementItemDirectionEnum.IN: 'IN',
  StatementItemDirectionEnum.OUT: 'OUT',
};
