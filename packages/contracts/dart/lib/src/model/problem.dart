//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'problem.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class Problem {
  /// Returns a new [Problem] instance.
  Problem({

    required  this.type,

    required  this.title,

    required  this.status,
  });

  @JsonKey(
    
    name: r'type',
    required: true,
    includeIfNull: false,
  )


  final ProblemTypeEnum type;



  @JsonKey(
    
    name: r'title',
    required: true,
    includeIfNull: false,
  )


  final String title;



          // minimum: -9007199254740991
          // maximum: 9007199254740991
  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final int status;





    @override
    bool operator ==(Object other) => identical(this, other) || other is Problem &&
      other.type == type &&
      other.title == title &&
      other.status == status;

    @override
    int get hashCode =>
        type.hashCode +
        title.hashCode +
        status.hashCode;

  factory Problem.fromJson(Map<String, dynamic> json) => _$ProblemFromJson(json);

  Map<String, dynamic> toJson() => _$ProblemToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum ProblemTypeEnum {
@JsonValue(r'about:blank')
aboutColonBlank(r'about:blank');

const ProblemTypeEnum(this.value);

final String value;

@override
String toString() => value;
}


