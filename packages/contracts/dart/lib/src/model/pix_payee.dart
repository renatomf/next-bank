//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
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
  )


  final PixPayeeKeyTypeEnum keyType;



  @JsonKey(
    
    name: r'keyMasked',
    required: true,
    includeIfNull: false,
  )


  final String keyMasked;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixPayee &&
      other.name == name &&
      other.documentMasked == documentMasked &&
      other.keyType == keyType &&
      other.keyMasked == keyMasked;

    @override
    int get hashCode =>
        name.hashCode +
        documentMasked.hashCode +
        keyType.hashCode +
        keyMasked.hashCode;

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
RANDOM(r'RANDOM');

const PixPayeeKeyTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


