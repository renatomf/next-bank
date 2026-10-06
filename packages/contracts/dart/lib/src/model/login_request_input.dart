//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'login_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class LoginRequestInput {
  /// Returns a new [LoginRequestInput] instance.
  LoginRequestInput({

    required  this.email,

    required  this.password,

     this.deviceLabel,
  });

  @JsonKey(
    
    name: r'email',
    required: true,
    includeIfNull: false,
  )


  final String email;



  @JsonKey(
    
    name: r'password',
    required: true,
    includeIfNull: false,
  )


  final String password;



  @JsonKey(
    
    name: r'deviceLabel',
    required: false,
    includeIfNull: false,
  )


  final String? deviceLabel;





    @override
    bool operator ==(Object other) => identical(this, other) || other is LoginRequestInput &&
      other.email == email &&
      other.password == password &&
      other.deviceLabel == deviceLabel;

    @override
    int get hashCode =>
        email.hashCode +
        password.hashCode +
        deviceLabel.hashCode;

  factory LoginRequestInput.fromJson(Map<String, dynamic> json) => _$LoginRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$LoginRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

