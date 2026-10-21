//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'top_up_operator.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TopUpOperator {
  /// Returns a new [TopUpOperator] instance.
  TopUpOperator({

    required  this.id,

    required  this.name,

    required  this.initials,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'initials',
    required: true,
    includeIfNull: false,
  )


  final String initials;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TopUpOperator &&
      other.id == id &&
      other.name == name &&
      other.initials == initials;

    @override
    int get hashCode =>
        id.hashCode +
        name.hashCode +
        initials.hashCode;

  factory TopUpOperator.fromJson(Map<String, dynamic> json) => _$TopUpOperatorFromJson(json);

  Map<String, dynamic> toJson() => _$TopUpOperatorToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

