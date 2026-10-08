//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_key_lookup_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixKeyLookupRequestInput {
  /// Returns a new [PixKeyLookupRequestInput] instance.
  PixKeyLookupRequestInput({

    required  this.type,

    required  this.value,
  });

  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  )


  final PixKeyLookupRequestInputTypeEnum type;



  @JsonKey(
    
    name: r'value',
    required: true,
    includeIfNull: false,
  )


  final String value;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixKeyLookupRequestInput &&
      other.type == type &&
      other.value == value;

    @override
    int get hashCode =>
        type.hashCode +
        value.hashCode;

  factory PixKeyLookupRequestInput.fromJson(Map<String, dynamic> json) => _$PixKeyLookupRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$PixKeyLookupRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PixKeyLookupRequestInputTypeEnum {
@JsonValue(r'CPF')
CPF(r'CPF'),
@JsonValue(r'EMAIL')
EMAIL(r'EMAIL'),
@JsonValue(r'PHONE')
PHONE(r'PHONE'),
@JsonValue(r'RANDOM')
RANDOM(r'RANDOM');

const PixKeyLookupRequestInputTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


