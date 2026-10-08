//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'verify_pin_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class VerifyPinRequestInput {
  /// Returns a new [VerifyPinRequestInput] instance.
  VerifyPinRequestInput({

    required  this.pin,
  });

  @JsonKey(
    
    name: r'pin',
    required: true,
    includeIfNull: false,
  )


  final String pin;





    @override
    bool operator ==(Object other) => identical(this, other) || other is VerifyPinRequestInput &&
      other.pin == pin;

    @override
    int get hashCode =>
        pin.hashCode;

  factory VerifyPinRequestInput.fromJson(Map<String, dynamic> json) => _$VerifyPinRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$VerifyPinRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

