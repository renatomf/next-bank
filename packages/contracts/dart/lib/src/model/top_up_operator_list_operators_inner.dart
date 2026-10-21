//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/money.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'top_up_operator_list_operators_inner.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TopUpOperatorListOperatorsInner {
  /// Returns a new [TopUpOperatorListOperatorsInner] instance.
  TopUpOperatorListOperatorsInner({

    required  this.id,

    required  this.name,

    required  this.initials,

    required  this.amounts,
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



  @JsonKey(
    
    name: r'amounts',
    required: true,
    includeIfNull: false,
  )


  final List<Money> amounts;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TopUpOperatorListOperatorsInner &&
      other.id == id &&
      other.name == name &&
      other.initials == initials &&
      other.amounts == amounts;

    @override
    int get hashCode =>
        id.hashCode +
        name.hashCode +
        initials.hashCode +
        amounts.hashCode;

  factory TopUpOperatorListOperatorsInner.fromJson(Map<String, dynamic> json) => _$TopUpOperatorListOperatorsInnerFromJson(json);

  Map<String, dynamic> toJson() => _$TopUpOperatorListOperatorsInnerToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

