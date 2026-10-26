//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/statement_counterparty.dart';
import 'package:nextbank_api/src/model/money.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'statement_item.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StatementItem {
  /// Returns a new [StatementItem] instance.
  StatementItem({

    required  this.id,

    required  this.occurredAt,

    required  this.kind,

    required  this.direction,

    required  this.amount,

    required  this.counterparty,

    required  this.transferId,

    required  this.topUpId,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'occurredAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime occurredAt;



  @JsonKey(
    
    name: r'kind',
    required: true,
    includeIfNull: false,
  )


  final StatementItemKindEnum kind;



  @JsonKey(
    
    name: r'direction',
    required: true,
    includeIfNull: false,
  )


  final StatementItemDirectionEnum direction;



  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final Money amount;



  @JsonKey(
    
    name: r'counterparty',
    required: true,
    includeIfNull: true,
  )


  final StatementCounterparty? counterparty;



  @JsonKey(
    
    name: r'transferId',
    required: true,
    includeIfNull: true,
  )


  final String? transferId;



  @JsonKey(
    
    name: r'topUpId',
    required: true,
    includeIfNull: true,
  )


  final String? topUpId;





    @override
    bool operator ==(Object other) => identical(this, other) || other is StatementItem &&
      other.id == id &&
      other.occurredAt == occurredAt &&
      other.kind == kind &&
      other.direction == direction &&
      other.amount == amount &&
      other.counterparty == counterparty &&
      other.transferId == transferId &&
      other.topUpId == topUpId;

    @override
    int get hashCode =>
        id.hashCode +
        occurredAt.hashCode +
        kind.hashCode +
        direction.hashCode +
        amount.hashCode +
        (counterparty == null ? 0 : counterparty.hashCode) +
        (transferId == null ? 0 : transferId.hashCode) +
        (topUpId == null ? 0 : topUpId.hashCode);

  factory StatementItem.fromJson(Map<String, dynamic> json) => _$StatementItemFromJson(json);

  Map<String, dynamic> toJson() => _$StatementItemToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum StatementItemKindEnum {
@JsonValue(r'PIX_SENT')
PIX_SENT(r'PIX_SENT'),
@JsonValue(r'PIX_RECEIVED')
PIX_RECEIVED(r'PIX_RECEIVED'),
@JsonValue(r'PIX_REFUNDED')
PIX_REFUNDED(r'PIX_REFUNDED'),
@JsonValue(r'DEMO_FUNDING')
DEMO_FUNDING(r'DEMO_FUNDING'),
@JsonValue(r'TOP_UP')
TOP_UP(r'TOP_UP');

const StatementItemKindEnum(this.value);

final String value;

@override
String toString() => value;
}


enum StatementItemDirectionEnum {
@JsonValue(r'IN')
IN(r'IN'),
@JsonValue(r'OUT')
OUT(r'OUT');

const StatementItemDirectionEnum(this.value);

final String value;

@override
String toString() => value;
}


