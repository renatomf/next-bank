//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'change_pin_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ChangePinRequestInput {
  /// Returns a new [ChangePinRequestInput] instance.
  ChangePinRequestInput({

    required  this.password,

    required  this.newPin,
  });

  @JsonKey(
    
    name: r'password',
    required: true,
    includeIfNull: false,
  )


  final String password;



  @JsonKey(
    
    name: r'newPin',
    required: true,
    includeIfNull: false,
  )


  final String newPin;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ChangePinRequestInput &&
      other.password == password &&
      other.newPin == newPin;

    @override
    int get hashCode =>
        password.hashCode +
        newPin.hashCode;

  factory ChangePinRequestInput.fromJson(Map<String, dynamic> json) => _$ChangePinRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$ChangePinRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

