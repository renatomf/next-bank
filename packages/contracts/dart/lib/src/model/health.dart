//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'health.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Health {
  /// Returns a new [Health] instance.
  Health({

    required  this.status,

     this.release,
  });

  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final HealthStatusEnum status;



      /// The commit running, when the host tells it
  @JsonKey(
    
    name: r'release',
    required: false,
    includeIfNull: false,
  )


  final String? release;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Health &&
      other.status == status &&
      other.release == release;

    @override
    int get hashCode =>
        status.hashCode +
        release.hashCode;

  factory Health.fromJson(Map<String, dynamic> json) => _$HealthFromJson(json);

  Map<String, dynamic> toJson() => _$HealthToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum HealthStatusEnum {
@JsonValue(r'ok')
ok(r'ok');

const HealthStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


