//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/top_up_operator.dart';
import 'package:nextbank_api/src/model/money.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'top_up.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TopUp {
  /// Returns a new [TopUp] instance.
  TopUp({

    required  this.id,

    required  this.operator_,

    required  this.phoneMasked,

    required  this.amount,

    required  this.status,

    required  this.createdAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'operator',
    required: true,
    includeIfNull: false,
  )


  final TopUpOperator operator_;



  @JsonKey(
    
    name: r'phoneMasked',
    required: true,
    includeIfNull: false,
  )


  final String phoneMasked;



  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final Money amount;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: TopUpStatusEnum.unknownDefaultOpenApi,
  )


  final TopUpStatusEnum status;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TopUp &&
      other.id == id &&
      other.operator_ == operator_ &&
      other.phoneMasked == phoneMasked &&
      other.amount == amount &&
      other.status == status &&
      other.createdAt == createdAt;

    @override
    int get hashCode =>
        id.hashCode +
        operator_.hashCode +
        phoneMasked.hashCode +
        amount.hashCode +
        status.hashCode +
        createdAt.hashCode;

  factory TopUp.fromJson(Map<String, dynamic> json) => _$TopUpFromJson(json);

  Map<String, dynamic> toJson() => _$TopUpToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum TopUpStatusEnum {
@JsonValue(r'COMPLETED')
COMPLETED(r'COMPLETED'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const TopUpStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


