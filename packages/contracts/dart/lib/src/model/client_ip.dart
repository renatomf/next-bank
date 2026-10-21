//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'client_ip.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ClientIp {
  /// Returns a new [ClientIp] instance.
  ClientIp({

    required  this.ip,
  });

      /// The address the API gives the caller, the one its limits count
  @JsonKey(
    
    name: r'ip',
    required: true,
    includeIfNull: false,
  )


  final String ip;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ClientIp &&
      other.ip == ip;

    @override
    int get hashCode =>
        ip.hashCode;

  factory ClientIp.fromJson(Map<String, dynamic> json) => _$ClientIpFromJson(json);

  Map<String, dynamic> toJson() => _$ClientIpToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

