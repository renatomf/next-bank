//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/active_session.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'session_list.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class SessionList {
  /// Returns a new [SessionList] instance.
  SessionList({

    required  this.items,
  });

  @JsonKey(
    
    name: r'items',
    required: true,
    includeIfNull: false,
  )


  final List<ActiveSession> items;





    @override
    bool operator ==(Object other) => identical(this, other) || other is SessionList &&
      other.items == items;

    @override
    int get hashCode =>
        items.hashCode;

  factory SessionList.fromJson(Map<String, dynamic> json) => _$SessionListFromJson(json);

  Map<String, dynamic> toJson() => _$SessionListToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

