//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'schedule_recurrence.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class ScheduleRecurrence {
  /// Returns a new [ScheduleRecurrence] instance.
  ScheduleRecurrence({

    required  this.frequency,

    required  this.times,
  });

  @JsonKey(
    
    name: r'frequency',
    required: true,
    includeIfNull: false,
  unknownEnumValue: ScheduleRecurrenceFrequencyEnum.unknownDefaultOpenApi,
  )


  final ScheduleRecurrenceFrequencyEnum frequency;



          // minimum: 1
          // maximum: 9007199254740991
  @JsonKey(
    
    name: r'times',
    required: true,
    includeIfNull: false,
  )


  final int times;





    @override
    bool operator ==(Object other) => identical(this, other) || other is ScheduleRecurrence &&
      other.frequency == frequency &&
      other.times == times;

    @override
    int get hashCode =>
        frequency.hashCode +
        times.hashCode;

  factory ScheduleRecurrence.fromJson(Map<String, dynamic> json) => _$ScheduleRecurrenceFromJson(json);

  Map<String, dynamic> toJson() => _$ScheduleRecurrenceToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum ScheduleRecurrenceFrequencyEnum {
@JsonValue(r'ONCE')
ONCE(r'ONCE'),
@JsonValue(r'MONTHLY')
MONTHLY(r'MONTHLY'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const ScheduleRecurrenceFrequencyEnum(this.value);

final String value;

@override
String toString() => value;
}


