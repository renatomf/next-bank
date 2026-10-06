//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'register_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RegisterRequestInput {
  /// Returns a new [RegisterRequestInput] instance.
  RegisterRequestInput({

    required  this.name,

    required  this.email,

    required  this.cpf,

    required  this.password,

     this.deviceLabel,
  });

  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'email',
    required: true,
    includeIfNull: false,
  )


  final String email;



  @JsonKey(
    
    name: r'cpf',
    required: true,
    includeIfNull: false,
  )


  final String cpf;



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
    bool operator ==(Object other) => identical(this, other) || other is RegisterRequestInput &&
      other.name == name &&
      other.email == email &&
      other.cpf == cpf &&
      other.password == password &&
      other.deviceLabel == deviceLabel;

    @override
    int get hashCode =>
        name.hashCode +
        email.hashCode +
        cpf.hashCode +
        password.hashCode +
        deviceLabel.hashCode;

  factory RegisterRequestInput.fromJson(Map<String, dynamic> json) => _$RegisterRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$RegisterRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

