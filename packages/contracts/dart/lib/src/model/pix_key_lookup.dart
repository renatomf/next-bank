//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_key_lookup.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixKeyLookup {
  /// Returns a new [PixKeyLookup] instance.
  PixKeyLookup({

    required  this.keyType,

    required  this.keyMasked,

    required  this.payeeName,

    required  this.payeeDocumentMasked,
  });

  @JsonKey(
    
    name: r'keyType',
    required: true,
    includeIfNull: false,
  )


  final PixKeyLookupKeyTypeEnum keyType;



  @JsonKey(
    
    name: r'keyMasked',
    required: true,
    includeIfNull: false,
  )


  final String keyMasked;



  @JsonKey(
    
    name: r'payeeName',
    required: true,
    includeIfNull: false,
  )


  final String payeeName;



  @JsonKey(
    
    name: r'payeeDocumentMasked',
    required: true,
    includeIfNull: false,
  )


  final String payeeDocumentMasked;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixKeyLookup &&
      other.keyType == keyType &&
      other.keyMasked == keyMasked &&
      other.payeeName == payeeName &&
      other.payeeDocumentMasked == payeeDocumentMasked;

    @override
    int get hashCode =>
        keyType.hashCode +
        keyMasked.hashCode +
        payeeName.hashCode +
        payeeDocumentMasked.hashCode;

  factory PixKeyLookup.fromJson(Map<String, dynamic> json) => _$PixKeyLookupFromJson(json);

  Map<String, dynamic> toJson() => _$PixKeyLookupToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PixKeyLookupKeyTypeEnum {
@JsonValue(r'CPF')
CPF(r'CPF'),
@JsonValue(r'EMAIL')
EMAIL(r'EMAIL'),
@JsonValue(r'PHONE')
PHONE(r'PHONE'),
@JsonValue(r'RANDOM')
RANDOM(r'RANDOM');

const PixKeyLookupKeyTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


