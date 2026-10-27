//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/schedule_recurrence.dart';
import 'package:nextbank_api/src/model/money.dart';
import 'package:nextbank_api/src/model/pix_schedule_occurrence.dart';
import 'package:nextbank_api/src/model/pix_schedule_payee.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_schedule_detail.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixScheduleDetail {
  /// Returns a new [PixScheduleDetail] instance.
  PixScheduleDetail({

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

    required  this.occurrences,
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
  unknownEnumValue: PixScheduleDetailStatusEnum.unknownDefaultOpenApi,
  )


  final PixScheduleDetailStatusEnum status;



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



  @JsonKey(
    
    name: r'occurrences',
    required: true,
    includeIfNull: false,
  )


  final List<PixScheduleOccurrence> occurrences;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixScheduleDetail &&
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
      other.cancelledAt == cancelledAt &&
      other.occurrences == occurrences;

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
        (cancelledAt == null ? 0 : cancelledAt.hashCode) +
        occurrences.hashCode;

  factory PixScheduleDetail.fromJson(Map<String, dynamic> json) => _$PixScheduleDetailFromJson(json);

  Map<String, dynamic> toJson() => _$PixScheduleDetailToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PixScheduleDetailStatusEnum {
@JsonValue(r'ACTIVE')
ACTIVE(r'ACTIVE'),
@JsonValue(r'FINISHED')
FINISHED(r'FINISHED'),
@JsonValue(r'CANCELLED')
CANCELLED(r'CANCELLED'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PixScheduleDetailStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


