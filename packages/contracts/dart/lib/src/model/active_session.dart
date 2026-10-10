//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'active_session.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ActiveSession {
  /// Returns a new [ActiveSession] instance.
  ActiveSession({

    required  this.id,

    required  this.deviceLabel,

    required  this.createdAt,

    required  this.lastUsedAt,

    required  this.current,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



      /// Set by the app at sign-in, e.g. \"Android 15\"
  @JsonKey(
    
    name: r'deviceLabel',
    required: true,
    includeIfNull: true,
  )


  final String? deviceLabel;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;



  @JsonKey(
    
    name: r'lastUsedAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime lastUsedAt;



      /// The session of the token that asked
  @JsonKey(
    
    name: r'current',
    required: true,
    includeIfNull: false,
  )


  final bool current;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ActiveSession &&
      other.id == id &&
      other.deviceLabel == deviceLabel &&
      other.createdAt == createdAt &&
      other.lastUsedAt == lastUsedAt &&
      other.current == current;

    @override
    int get hashCode =>
        id.hashCode +
        (deviceLabel == null ? 0 : deviceLabel.hashCode) +
        createdAt.hashCode +
        lastUsedAt.hashCode +
        current.hashCode;

  factory ActiveSession.fromJson(Map<String, dynamic> json) => _$ActiveSessionFromJson(json);

  Map<String, dynamic> toJson() => _$ActiveSessionToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

