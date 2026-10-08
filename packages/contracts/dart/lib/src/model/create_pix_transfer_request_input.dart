//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/create_pix_transfer_request_input_key.dart';
import 'package:nextbank_api/src/model/money_input.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_pix_transfer_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreatePixTransferRequestInput {
  /// Returns a new [CreatePixTransferRequestInput] instance.
  CreatePixTransferRequestInput({

    required  this.key,

    required  this.amount,

     this.description,
  });

  @JsonKey(
    
    name: r'key',
    required: true,
    includeIfNull: false,
  )


  final CreatePixTransferRequestInputKey key;



  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final MoneyInput amount;



  @JsonKey(
    
    name: r'description',
    required: false,
    includeIfNull: false,
  )


  final String? description;





    @override
    bool operator ==(Object other) => identical(this, other) || other is CreatePixTransferRequestInput &&
      other.key == key &&
      other.amount == amount &&
      other.description == description;

    @override
    int get hashCode =>
        key.hashCode +
        amount.hashCode +
        description.hashCode;

  factory CreatePixTransferRequestInput.fromJson(Map<String, dynamic> json) => _$CreatePixTransferRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$CreatePixTransferRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

