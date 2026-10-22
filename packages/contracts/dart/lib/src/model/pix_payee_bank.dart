//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_payee_bank.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixPayeeBank {
  /// Returns a new [PixPayeeBank] instance.
  PixPayeeBank({

    required  this.ispb,

    required  this.name,
  });

  @JsonKey(
    
    name: r'ispb',
    required: true,
    includeIfNull: false,
  )


  final String ispb;



  @JsonKey(
    
    name: r'name',
    required: true,
    includeIfNull: false,
  )


  final String name;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixPayeeBank &&
      other.ispb == ispb &&
      other.name == name;

    @override
    int get hashCode =>
        ispb.hashCode +
        name.hashCode;

  factory PixPayeeBank.fromJson(Map<String, dynamic> json) => _$PixPayeeBankFromJson(json);

  Map<String, dynamic> toJson() => _$PixPayeeBankToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

