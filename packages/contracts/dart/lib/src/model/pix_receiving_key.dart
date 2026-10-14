//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_receiving_key.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixReceivingKey {
  /// Returns a new [PixReceivingKey] instance.
  PixReceivingKey({

    required  this.key,

    required  this.keyMasked,
  });

  @JsonKey(
    
    name: r'key',
    required: true,
    includeIfNull: false,
  )


  final String key;



  @JsonKey(
    
    name: r'keyMasked',
    required: true,
    includeIfNull: false,
  )


  final String keyMasked;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixReceivingKey &&
      other.key == key &&
      other.keyMasked == keyMasked;

    @override
    int get hashCode =>
        key.hashCode +
        keyMasked.hashCode;

  factory PixReceivingKey.fromJson(Map<String, dynamic> json) => _$PixReceivingKeyFromJson(json);

  Map<String, dynamic> toJson() => _$PixReceivingKeyToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

