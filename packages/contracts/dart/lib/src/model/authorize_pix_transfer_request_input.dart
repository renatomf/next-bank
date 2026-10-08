//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'authorize_pix_transfer_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class AuthorizePixTransferRequestInput {
  /// Returns a new [AuthorizePixTransferRequestInput] instance.
  AuthorizePixTransferRequestInput({

    required  this.pin,
  });

  @JsonKey(
    
    name: r'pin',
    required: true,
    includeIfNull: false,
  )


  final String pin;





    @override
    bool operator ==(Object other) => identical(this, other) || other is AuthorizePixTransferRequestInput &&
      other.pin == pin;

    @override
    int get hashCode =>
        pin.hashCode;

  factory AuthorizePixTransferRequestInput.fromJson(Map<String, dynamic> json) => _$AuthorizePixTransferRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$AuthorizePixTransferRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

