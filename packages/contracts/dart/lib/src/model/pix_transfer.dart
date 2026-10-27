//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/pix_payee.dart';
import 'package:nextbank_api/src/model/money.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_transfer.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixTransfer {
  /// Returns a new [PixTransfer] instance.
  PixTransfer({

    required  this.id,

    required  this.status,

    required  this.amount,

    required  this.description,

    required  this.payee,

    required  this.endToEndId,

    required  this.failureReason,

    required  this.createdAt,

    required  this.expiresAt,

    required  this.completedAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: PixTransferStatusEnum.unknownDefaultOpenApi,
  )


  final PixTransferStatusEnum status;



  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final Money amount;



  @JsonKey(
    
    name: r'description',
    required: true,
    includeIfNull: true,
  )


  final String? description;



  @JsonKey(
    
    name: r'payee',
    required: true,
    includeIfNull: false,
  )


  final PixPayee payee;



  @JsonKey(
    
    name: r'endToEndId',
    required: true,
    includeIfNull: true,
  )


  final String? endToEndId;



  @JsonKey(
    
    name: r'failureReason',
    required: true,
    includeIfNull: true,
  unknownEnumValue: PixTransferFailureReasonEnum.unknownDefaultOpenApi,
  )


  final PixTransferFailureReasonEnum? failureReason;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;



  @JsonKey(
    
    name: r'expiresAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime expiresAt;



  @JsonKey(
    
    name: r'completedAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? completedAt;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixTransfer &&
      other.id == id &&
      other.status == status &&
      other.amount == amount &&
      other.description == description &&
      other.payee == payee &&
      other.endToEndId == endToEndId &&
      other.failureReason == failureReason &&
      other.createdAt == createdAt &&
      other.expiresAt == expiresAt &&
      other.completedAt == completedAt;

    @override
    int get hashCode =>
        id.hashCode +
        status.hashCode +
        amount.hashCode +
        (description == null ? 0 : description.hashCode) +
        payee.hashCode +
        (endToEndId == null ? 0 : endToEndId.hashCode) +
        (failureReason == null ? 0 : failureReason.hashCode) +
        createdAt.hashCode +
        expiresAt.hashCode +
        (completedAt == null ? 0 : completedAt.hashCode);

  factory PixTransfer.fromJson(Map<String, dynamic> json) => _$PixTransferFromJson(json);

  Map<String, dynamic> toJson() => _$PixTransferToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PixTransferStatusEnum {
@JsonValue(r'AWAITING_AUTH')
AWAITING_AUTH(r'AWAITING_AUTH'),
@JsonValue(r'PROCESSING')
PROCESSING(r'PROCESSING'),
@JsonValue(r'COMPLETED')
COMPLETED(r'COMPLETED'),
@JsonValue(r'FAILED')
FAILED(r'FAILED'),
@JsonValue(r'CANCELLED')
CANCELLED(r'CANCELLED'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PixTransferStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


enum PixTransferFailureReasonEnum {
@JsonValue(r'INSUFFICIENT_FUNDS')
INSUFFICIENT_FUNDS(r'INSUFFICIENT_FUNDS'),
@JsonValue(r'LIMIT_EXCEEDED')
LIMIT_EXCEEDED(r'LIMIT_EXCEEDED'),
@JsonValue(r'PAYEE_UNAVAILABLE')
PAYEE_UNAVAILABLE(r'PAYEE_UNAVAILABLE'),
@JsonValue(r'ACCOUNT_BLOCKED')
ACCOUNT_BLOCKED(r'ACCOUNT_BLOCKED'),
@JsonValue(r'PAYEE_BANK_REJECTED')
PAYEE_BANK_REJECTED(r'PAYEE_BANK_REJECTED'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PixTransferFailureReasonEnum(this.value);

final String value;

@override
String toString() => value;
}


