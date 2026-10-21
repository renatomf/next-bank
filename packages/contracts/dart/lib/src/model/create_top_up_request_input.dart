//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/money_input.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_top_up_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreateTopUpRequestInput {
  /// Returns a new [CreateTopUpRequestInput] instance.
  CreateTopUpRequestInput({

    required  this.operatorId,

    required  this.phoneNumber,

    required  this.amount,

    required  this.pin,
  });

  @JsonKey(
    
    name: r'operatorId',
    required: true,
    includeIfNull: false,
  )


  final String operatorId;



  @JsonKey(
    
    name: r'phoneNumber',
    required: true,
    includeIfNull: false,
  )


  final String phoneNumber;



  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final MoneyInput amount;



  @JsonKey(
    
    name: r'pin',
    required: true,
    includeIfNull: false,
  )


  final String pin;





    @override
    bool operator ==(Object other) => identical(this, other) || other is CreateTopUpRequestInput &&
      other.operatorId == operatorId &&
      other.phoneNumber == phoneNumber &&
      other.amount == amount &&
      other.pin == pin;

    @override
    int get hashCode =>
        operatorId.hashCode +
        phoneNumber.hashCode +
        amount.hashCode +
        pin.hashCode;

  factory CreateTopUpRequestInput.fromJson(Map<String, dynamic> json) => _$CreateTopUpRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$CreateTopUpRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

