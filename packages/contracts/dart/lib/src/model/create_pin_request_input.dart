//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_pin_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreatePinRequestInput {
  /// Returns a new [CreatePinRequestInput] instance.
  CreatePinRequestInput({

    required  this.pin,
  });

  @JsonKey(
    
    name: r'pin',
    required: true,
    includeIfNull: false,
  )


  final String pin;





    @override
    bool operator ==(Object other) => identical(this, other) || other is CreatePinRequestInput &&
      other.pin == pin;

    @override
    int get hashCode =>
        pin.hashCode;

  factory CreatePinRequestInput.fromJson(Map<String, dynamic> json) => _$CreatePinRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$CreatePinRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

