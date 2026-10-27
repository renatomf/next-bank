//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/pix_payee_bank.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_payee.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixPayee {
  /// Returns a new [PixPayee] instance.
  PixPayee({

    required  this.name,

    required  this.documentMasked,

    required  this.keyType,

    required  this.keyMasked,

     this.bank,
  });

  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'documentMasked',
    required: true,
    includeIfNull: false,
  )


  final String documentMasked;



  @JsonKey(
    
    name: r'keyType',
    required: true,
    includeIfNull: false,
  unknownEnumValue: PixPayeeKeyTypeEnum.unknownDefaultOpenApi,
  )


  final PixPayeeKeyTypeEnum keyType;



  @JsonKey(
    
    name: r'keyMasked',
    required: true,
    includeIfNull: false,
  )


  final String keyMasked;



  @JsonKey(
    
    name: r'bank',
    required: false,
    includeIfNull: false,
  )


  final PixPayeeBank? bank;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixPayee &&
      other.name == name &&
      other.documentMasked == documentMasked &&
      other.keyType == keyType &&
      other.keyMasked == keyMasked &&
      other.bank == bank;

    @override
    int get hashCode =>
        name.hashCode +
        documentMasked.hashCode +
        keyType.hashCode +
        keyMasked.hashCode +
        bank.hashCode;

  factory PixPayee.fromJson(Map<String, dynamic> json) => _$PixPayeeFromJson(json);

  Map<String, dynamic> toJson() => _$PixPayeeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PixPayeeKeyTypeEnum {
@JsonValue(r'CPF')
CPF(r'CPF'),
@JsonValue(r'EMAIL')
EMAIL(r'EMAIL'),
@JsonValue(r'PHONE')
PHONE(r'PHONE'),
@JsonValue(r'RANDOM')
RANDOM(r'RANDOM'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PixPayeeKeyTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


