//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/pix_key_request_input.dart';
import 'package:nextbank_api/src/model/schedule_recurrence_request_input.dart';
import 'package:nextbank_api/src/model/money_input.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'create_pix_schedule_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class CreatePixScheduleRequestInput {
  /// Returns a new [CreatePixScheduleRequestInput] instance.
  CreatePixScheduleRequestInput({

    required  this.key,

    required  this.amount,

     this.description,

    required  this.firstDate,

    required  this.recurrence,

    required  this.pin,
  });

  @JsonKey(
    
    name: r'key',
    required: true,
    includeIfNull: false,
  )


  final PixKeyRequestInput key;



  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final MoneyInput amount;



  @JsonKey(
    
    name: r'description',
    required: false,
    includeIfNull: false,
  )


  final String? description;



  @JsonKey(
    
    name: r'firstDate',
    required: true,
    includeIfNull: false,
  )


  final DateTime firstDate;



  @JsonKey(
    
    name: r'recurrence',
    required: true,
    includeIfNull: false,
  )


  final ScheduleRecurrenceRequestInput recurrence;



  @JsonKey(
    
    name: r'pin',
    required: true,
    includeIfNull: false,
  )


  final String pin;





    @override
    bool operator ==(Object other) => identical(this, other) || other is CreatePixScheduleRequestInput &&
      other.key == key &&
      other.amount == amount &&
      other.description == description &&
      other.firstDate == firstDate &&
      other.recurrence == recurrence &&
      other.pin == pin;

    @override
    int get hashCode =>
        key.hashCode +
        amount.hashCode +
        description.hashCode +
        firstDate.hashCode +
        recurrence.hashCode +
        pin.hashCode;

  factory CreatePixScheduleRequestInput.fromJson(Map<String, dynamic> json) => _$CreatePixScheduleRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$CreatePixScheduleRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

