// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'pix_transfer.dart';

// **************************************************************************
// CopyWithGenerator
// **************************************************************************

abstract class _$PixTransferCWProxy {
  PixTransfer id(String id);

  PixTransfer status(PixTransferStatusEnum status);

  PixTransfer amount(Money amount);

  PixTransfer description(String? description);

  PixTransfer payee(PixPayee payee);

  PixTransfer endToEndId(String? endToEndId);

  PixTransfer failureReason(PixTransferFailureReasonEnum? failureReason);

  PixTransfer createdAt(DateTime createdAt);

  PixTransfer expiresAt(DateTime expiresAt);

  PixTransfer completedAt(DateTime? completedAt);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixTransfer(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixTransfer(...).copyWith(id: 12, name: "My name")
  /// ```
  PixTransfer call({
    String id,
    PixTransferStatusEnum status,
    Money amount,
    String? description,
    PixPayee payee,
    String? endToEndId,
    PixTransferFailureReasonEnum? failureReason,
    DateTime createdAt,
    DateTime expiresAt,
    DateTime? completedAt,
  });
}

/// Callable proxy for `copyWith` functionality.
/// Use as `instanceOfPixTransfer.copyWith(...)` or call `instanceOfPixTransfer.copyWith.fieldName(value)` for a single field.
class _$PixTransferCWProxyImpl implements _$PixTransferCWProxy {
  const _$PixTransferCWProxyImpl(this._value);

  final PixTransfer _value;

  @override
  PixTransfer id(String id) => call(id: id);

  @override
  PixTransfer status(PixTransferStatusEnum status) => call(status: status);

  @override
  PixTransfer amount(Money amount) => call(amount: amount);

  @override
  PixTransfer description(String? description) =>
      call(description: description);

  @override
  PixTransfer payee(PixPayee payee) => call(payee: payee);

  @override
  PixTransfer endToEndId(String? endToEndId) => call(endToEndId: endToEndId);

  @override
  PixTransfer failureReason(PixTransferFailureReasonEnum? failureReason) =>
      call(failureReason: failureReason);

  @override
  PixTransfer createdAt(DateTime createdAt) => call(createdAt: createdAt);

  @override
  PixTransfer expiresAt(DateTime expiresAt) => call(expiresAt: expiresAt);

  @override
  PixTransfer completedAt(DateTime? completedAt) =>
      call(completedAt: completedAt);

  /// Creates a new instance with the provided field values.
  /// Omitted fields keep their values; explicit `null` clears nullable fields.
  /// The public API rejects `null` for non-nullable fields. To update a single field use `PixTransfer(...).copyWith.fieldName(value)`.
  ///
  /// Example:
  /// ```dart
  /// PixTransfer(...).copyWith(id: 12, name: "My name")
  /// ```
  @override
  PixTransfer call({
    Object? id = const $CopyWithPlaceholder(),
    Object? status = const $CopyWithPlaceholder(),
    Object? amount = const $CopyWithPlaceholder(),
    Object? description = const $CopyWithPlaceholder(),
    Object? payee = const $CopyWithPlaceholder(),
    Object? endToEndId = const $CopyWithPlaceholder(),
    Object? failureReason = const $CopyWithPlaceholder(),
    Object? createdAt = const $CopyWithPlaceholder(),
    Object? expiresAt = const $CopyWithPlaceholder(),
    Object? completedAt = const $CopyWithPlaceholder(),
  }) {
    return PixTransfer(
      id: id == const $CopyWithPlaceholder() || id == null
          ? _value.id
          // ignore: cast_nullable_to_non_nullable
          : id as String,
      status: status == const $CopyWithPlaceholder() || status == null
          ? _value.status
          // ignore: cast_nullable_to_non_nullable
          : status as PixTransferStatusEnum,
      amount: amount == const $CopyWithPlaceholder() || amount == null
          ? _value.amount
          // ignore: cast_nullable_to_non_nullable
          : amount as Money,
      description: description == const $CopyWithPlaceholder()
          ? _value.description
          // ignore: cast_nullable_to_non_nullable
          : description as String?,
      payee: payee == const $CopyWithPlaceholder() || payee == null
          ? _value.payee
          // ignore: cast_nullable_to_non_nullable
          : payee as PixPayee,
      endToEndId: endToEndId == const $CopyWithPlaceholder()
          ? _value.endToEndId
          // ignore: cast_nullable_to_non_nullable
          : endToEndId as String?,
      failureReason: failureReason == const $CopyWithPlaceholder()
          ? _value.failureReason
          // ignore: cast_nullable_to_non_nullable
          : failureReason as PixTransferFailureReasonEnum?,
      createdAt: createdAt == const $CopyWithPlaceholder() || createdAt == null
          ? _value.createdAt
          // ignore: cast_nullable_to_non_nullable
          : createdAt as DateTime,
      expiresAt: expiresAt == const $CopyWithPlaceholder() || expiresAt == null
          ? _value.expiresAt
          // ignore: cast_nullable_to_non_nullable
          : expiresAt as DateTime,
      completedAt: completedAt == const $CopyWithPlaceholder()
          ? _value.completedAt
          // ignore: cast_nullable_to_non_nullable
          : completedAt as DateTime?,
    );
  }
}

extension $PixTransferCopyWith on PixTransfer {
  /// Returns a callable class used to build a new instance with modified fields.
  /// Example: `instanceOfPixTransfer.copyWith(...)` or `instanceOfPixTransfer.copyWith.fieldName(...)`.
  // ignore: library_private_types_in_public_api
  _$PixTransferCWProxy get copyWith => _$PixTransferCWProxyImpl(this);
}

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

PixTransfer _$PixTransferFromJson(
  Map<String, dynamic> json,
) => $checkedCreate('PixTransfer', json, ($checkedConvert) {
  $checkKeys(
    json,
    requiredKeys: const [
      'id',
      'status',
      'amount',
      'description',
      'payee',
      'endToEndId',
      'failureReason',
      'createdAt',
      'expiresAt',
      'completedAt',
    ],
  );
  final val = PixTransfer(
    id: $checkedConvert('id', (v) => v as String),
    status: $checkedConvert(
      'status',
      (v) => $enumDecode(
        _$PixTransferStatusEnumEnumMap,
        v,
        unknownValue: PixTransferStatusEnum.unknownDefaultOpenApi,
      ),
    ),
    amount: $checkedConvert(
      'amount',
      (v) => Money.fromJson(v as Map<String, dynamic>),
    ),
    description: $checkedConvert('description', (v) => v as String?),
    payee: $checkedConvert(
      'payee',
      (v) => PixPayee.fromJson(v as Map<String, dynamic>),
    ),
    endToEndId: $checkedConvert('endToEndId', (v) => v as String?),
    failureReason: $checkedConvert(
      'failureReason',
      (v) => $enumDecodeNullable(
        _$PixTransferFailureReasonEnumEnumMap,
        v,
        unknownValue: PixTransferFailureReasonEnum.unknownDefaultOpenApi,
      ),
    ),
    createdAt: $checkedConvert('createdAt', (v) => DateTime.parse(v as String)),
    expiresAt: $checkedConvert('expiresAt', (v) => DateTime.parse(v as String)),
    completedAt: $checkedConvert(
      'completedAt',
      (v) => v == null ? null : DateTime.parse(v as String),
    ),
  );
  return val;
});

Map<String, dynamic> _$PixTransferToJson(PixTransfer instance) =>
    <String, dynamic>{
      'id': instance.id,
      'status': _$PixTransferStatusEnumEnumMap[instance.status]!,
      'amount': instance.amount.toJson(),
      'description': instance.description,
      'payee': instance.payee.toJson(),
      'endToEndId': instance.endToEndId,
      'failureReason':
          _$PixTransferFailureReasonEnumEnumMap[instance.failureReason],
      'createdAt': instance.createdAt.toIso8601String(),
      'expiresAt': instance.expiresAt.toIso8601String(),
      'completedAt': instance.completedAt?.toIso8601String(),
    };

const _$PixTransferStatusEnumEnumMap = {
  PixTransferStatusEnum.AWAITING_AUTH: 'AWAITING_AUTH',
  PixTransferStatusEnum.PROCESSING: 'PROCESSING',
  PixTransferStatusEnum.COMPLETED: 'COMPLETED',
  PixTransferStatusEnum.FAILED: 'FAILED',
  PixTransferStatusEnum.CANCELLED: 'CANCELLED',
  PixTransferStatusEnum.unknownDefaultOpenApi: 'unknown_default_open_api',
};

const _$PixTransferFailureReasonEnumEnumMap = {
  PixTransferFailureReasonEnum.INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  PixTransferFailureReasonEnum.LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
  PixTransferFailureReasonEnum.PAYEE_UNAVAILABLE: 'PAYEE_UNAVAILABLE',
  PixTransferFailureReasonEnum.ACCOUNT_BLOCKED: 'ACCOUNT_BLOCKED',
  PixTransferFailureReasonEnum.PAYEE_BANK_REJECTED: 'PAYEE_BANK_REJECTED',
  PixTransferFailureReasonEnum.unknownDefaultOpenApi:
      'unknown_default_open_api',
};
