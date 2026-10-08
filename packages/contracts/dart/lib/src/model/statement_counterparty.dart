//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'statement_counterparty.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class StatementCounterparty {
  /// Returns a new [StatementCounterparty] instance.
  StatementCounterparty({

    required  this.name,

    required  this.documentMasked,
  });

  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;



  @JsonKey(
    
    name: r'documentMasked',
    required: true,
    includeIfNull: true,
  )


  final String? documentMasked;





    @override
    bool operator ==(Object other) => identical(this, other) || other is StatementCounterparty &&
      other.name == name &&
      other.documentMasked == documentMasked;

    @override
    int get hashCode =>
        name.hashCode +
        (documentMasked == null ? 0 : documentMasked.hashCode);

  factory StatementCounterparty.fromJson(Map<String, dynamic> json) => _$StatementCounterpartyFromJson(json);

  Map<String, dynamic> toJson() => _$StatementCounterpartyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

