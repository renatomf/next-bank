//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'refresh_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class RefreshRequestInput {
  /// Returns a new [RefreshRequestInput] instance.
  RefreshRequestInput({

    required  this.refreshToken,
  });

  @JsonKey(
    
    name: r'refreshToken',
    required: true,
    includeIfNull: false,
  )


  final String refreshToken;





    @override
    bool operator ==(Object other) => identical(this, other) || other is RefreshRequestInput &&
      other.refreshToken == refreshToken;

    @override
    int get hashCode =>
        refreshToken.hashCode;

  factory RefreshRequestInput.fromJson(Map<String, dynamic> json) => _$RefreshRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$RefreshRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

