//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/schedule_recurrence.dart';
import 'package:nextbank_api/src/model/money.dart';
import 'package:nextbank_api/src/model/pix_schedule_payee.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_schedule.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixSchedule {
  /// Returns a new [PixSchedule] instance.
  PixSchedule({

    required  this.id,

    required  this.status,

    required  this.amount,

    required  this.description,

    required  this.payee,

    required  this.firstDate,

    required  this.recurrence,

    required  this.nextOccurrenceDate,

    required  this.lastOccurrenceDate,

    required  this.createdAt,

    required  this.cancelledAt,
  });

  @JsonKey(
    
    name: r'id',
    required: true,
    includeIfNull: false,
  )


  final String id;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: PixScheduleStatusEnum.unknownDefaultOpenApi,
  )


  final PixScheduleStatusEnum status;



  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final Money amount;



  @JsonKey(
    
    name: r'description',
    required: true,
    includeIfNull: true,
  )


  final String? description;



  @JsonKey(
    
    name: r'payee',
    required: true,
    includeIfNull: false,
  )


  final PixSchedulePayee payee;



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


  final ScheduleRecurrence recurrence;



  @JsonKey(
    
    name: r'nextOccurrenceDate',
    required: true,
    includeIfNull: true,
  )


  final DateTime? nextOccurrenceDate;



  @JsonKey(
    
    name: r'lastOccurrenceDate',
    required: true,
    includeIfNull: false,
  )


  final DateTime lastOccurrenceDate;



  @JsonKey(
    
    name: r'createdAt',
    required: true,
    includeIfNull: false,
  )


  final DateTime createdAt;



  @JsonKey(
    
    name: r'cancelledAt',
    required: true,
    includeIfNull: true,
  )


  final DateTime? cancelledAt;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixSchedule &&
      other.id == id &&
      other.status == status &&
      other.amount == amount &&
      other.description == description &&
      other.payee == payee &&
      other.firstDate == firstDate &&
      other.recurrence == recurrence &&
      other.nextOccurrenceDate == nextOccurrenceDate &&
      other.lastOccurrenceDate == lastOccurrenceDate &&
      other.createdAt == createdAt &&
      other.cancelledAt == cancelledAt;

    @override
    int get hashCode =>
        id.hashCode +
        status.hashCode +
        amount.hashCode +
        (description == null ? 0 : description.hashCode) +
        payee.hashCode +
        firstDate.hashCode +
        recurrence.hashCode +
        (nextOccurrenceDate == null ? 0 : nextOccurrenceDate.hashCode) +
        lastOccurrenceDate.hashCode +
        createdAt.hashCode +
        (cancelledAt == null ? 0 : cancelledAt.hashCode);

  factory PixSchedule.fromJson(Map<String, dynamic> json) => _$PixScheduleFromJson(json);

  Map<String, dynamic> toJson() => _$PixScheduleToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PixScheduleStatusEnum {
@JsonValue(r'ACTIVE')
ACTIVE(r'ACTIVE'),
@JsonValue(r'FINISHED')
FINISHED(r'FINISHED'),
@JsonValue(r'CANCELLED')
CANCELLED(r'CANCELLED'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PixScheduleStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


