//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'schedule_recurrence_request_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ScheduleRecurrenceRequestInput {
  /// Returns a new [ScheduleRecurrenceRequestInput] instance.
  ScheduleRecurrenceRequestInput({

    required  this.frequency,

     this.times,
  });

  @JsonKey(
    
    name: r'frequency',
    required: true,
    includeIfNull: false,
  unknownEnumValue: ScheduleRecurrenceRequestInputFrequencyEnum.unknownDefaultOpenApi,
  )


  final ScheduleRecurrenceRequestInputFrequencyEnum frequency;



          // minimum: 1
          // maximum: 99
  @JsonKey(
    
    name: r'times',
    required: false,
    includeIfNull: false,
  )


  final int? times;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ScheduleRecurrenceRequestInput &&
      other.frequency == frequency &&
      other.times == times;

    @override
    int get hashCode =>
        frequency.hashCode +
        times.hashCode;

  factory ScheduleRecurrenceRequestInput.fromJson(Map<String, dynamic> json) => _$ScheduleRecurrenceRequestInputFromJson(json);

  Map<String, dynamic> toJson() => _$ScheduleRecurrenceRequestInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum ScheduleRecurrenceRequestInputFrequencyEnum {
@JsonValue(r'ONCE')
ONCE(r'ONCE'),
@JsonValue(r'MONTHLY')
MONTHLY(r'MONTHLY'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const ScheduleRecurrenceRequestInputFrequencyEnum(this.value);

final String value;

@override
String toString() => value;
}


