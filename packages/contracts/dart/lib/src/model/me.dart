//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'me.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Me {
  /// Returns a new [Me] instance.
  Me({

    required  this.name,

    required  this.hasPin,
  });

  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



      /// False while registration still needs the transaction PIN
  @JsonKey(
    
    name: r'hasPin',
    required: true,
    includeIfNull: false,
  )


  final bool hasPin;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Me &&
      other.name == name &&
      other.hasPin == hasPin;

    @override
    int get hashCode =>
        name.hashCode +
        hasPin.hashCode;

  factory Me.fromJson(Map<String, dynamic> json) => _$MeFromJson(json);

  Map<String, dynamic> toJson() => _$MeToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

