//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_pix_transfer_request_input_key.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreatePixTransferRequestInputKey {
  /// Returns a new [CreatePixTransferRequestInputKey] instance.
  CreatePixTransferRequestInputKey({

    required  this.type,

    required  this.value,
  });

  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  )


  final CreatePixTransferRequestInputKeyTypeEnum type;



  @JsonKey(
    
    name: r'value',
    required: true,
    includeIfNull: false,
  )


  final String value;





    @override
    bool operator ==(Object other) => identical(this, other) || other is CreatePixTransferRequestInputKey &&
      other.type == type &&
      other.value == value;

    @override
    int get hashCode =>
        type.hashCode +
        value.hashCode;

  factory CreatePixTransferRequestInputKey.fromJson(Map<String, dynamic> json) => _$CreatePixTransferRequestInputKeyFromJson(json);

  Map<String, dynamic> toJson() => _$CreatePixTransferRequestInputKeyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum CreatePixTransferRequestInputKeyTypeEnum {
@JsonValue(r'CPF')
CPF(r'CPF'),
@JsonValue(r'EMAIL')
EMAIL(r'EMAIL'),
@JsonValue(r'PHONE')
PHONE(r'PHONE'),
@JsonValue(r'RANDOM')
RANDOM(r'RANDOM');

const CreatePixTransferRequestInputKeyTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


