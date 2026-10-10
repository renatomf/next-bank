//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'change_password_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ChangePasswordRequestInput {
  /// Returns a new [ChangePasswordRequestInput] instance.
  ChangePasswordRequestInput({

    required  this.currentPassword,

    required  this.newPassword,
  });

  @JsonKey(
    
    name: r'currentPassword',
    required: true,
    includeIfNull: false,
  )


  final String currentPassword;



  @JsonKey(
    
    name: r'newPassword',
    required: true,
    includeIfNull: false,
  )


  final String newPassword;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ChangePasswordRequestInput &&
      other.currentPassword == currentPassword &&
      other.newPassword == newPassword;

    @override
    int get hashCode =>
        currentPassword.hashCode +
        newPassword.hashCode;

  factory ChangePasswordRequestInput.fromJson(Map<String, dynamic> json) => _$ChangePasswordRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$ChangePasswordRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

