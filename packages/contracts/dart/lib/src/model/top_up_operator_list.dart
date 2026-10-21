//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/top_up_operator_list_operators_inner.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'top_up_operator_list.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class TopUpOperatorList {
  /// Returns a new [TopUpOperatorList] instance.
  TopUpOperatorList({

    required  this.operators,
  });

  @JsonKey(
    
    name: r'operators',
    required: true,
    includeIfNull: false,
  )


  final List<TopUpOperatorListOperatorsInner> operators;





    @override
    bool operator ==(Object other) => identical(this, other) || other is TopUpOperatorList &&
      other.operators == operators;

    @override
    int get hashCode =>
        operators.hashCode;

  factory TopUpOperatorList.fromJson(Map<String, dynamic> json) => _$TopUpOperatorListFromJson(json);

  Map<String, dynamic> toJson() => _$TopUpOperatorListToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

