//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'pix_schedule_occurrence.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class PixScheduleOccurrence {
  /// Returns a new [PixScheduleOccurrence] instance.
  PixScheduleOccurrence({

    required  this.sequence,

    required  this.date,

    required  this.transferId,

    required  this.status,

    required  this.failureReason,
  });

          // minimum: 1
          // maximum: 9007199254740991
  @JsonKey(
    
    name: r'sequence',
    required: true,
    includeIfNull: false,
  )


  final int sequence;



  @JsonKey(
    
    name: r'date',
    required: true,
    includeIfNull: false,
  )


  final DateTime date;



  @JsonKey(
    
    name: r'transferId',
    required: true,
    includeIfNull: false,
  )


  final String transferId;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  unknownEnumValue: PixScheduleOccurrenceStatusEnum.unknownDefaultOpenApi,
  )


  final PixScheduleOccurrenceStatusEnum status;



  @JsonKey(
    
    name: r'failureReason',
    required: true,
    includeIfNull: true,
  unknownEnumValue: PixScheduleOccurrenceFailureReasonEnum.unknownDefaultOpenApi,
  )


  final PixScheduleOccurrenceFailureReasonEnum? failureReason;





    @override
    bool operator ==(Object other) => identical(this, other) || other is PixScheduleOccurrence &&
      other.sequence == sequence &&
      other.date == date &&
      other.transferId == transferId &&
      other.status == status &&
      other.failureReason == failureReason;

    @override
    int get hashCode =>
        sequence.hashCode +
        date.hashCode +
        transferId.hashCode +
        status.hashCode +
        (failureReason == null ? 0 : failureReason.hashCode);

  factory PixScheduleOccurrence.fromJson(Map<String, dynamic> json) => _$PixScheduleOccurrenceFromJson(json);

  Map<String, dynamic> toJson() => _$PixScheduleOccurrenceToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum PixScheduleOccurrenceStatusEnum {
@JsonValue(r'AWAITING_AUTH')
AWAITING_AUTH(r'AWAITING_AUTH'),
@JsonValue(r'PROCESSING')
PROCESSING(r'PROCESSING'),
@JsonValue(r'COMPLETED')
COMPLETED(r'COMPLETED'),
@JsonValue(r'FAILED')
FAILED(r'FAILED'),
@JsonValue(r'CANCELLED')
CANCELLED(r'CANCELLED'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PixScheduleOccurrenceStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


enum PixScheduleOccurrenceFailureReasonEnum {
@JsonValue(r'INSUFFICIENT_FUNDS')
INSUFFICIENT_FUNDS(r'INSUFFICIENT_FUNDS'),
@JsonValue(r'LIMIT_EXCEEDED')
LIMIT_EXCEEDED(r'LIMIT_EXCEEDED'),
@JsonValue(r'PAYEE_UNAVAILABLE')
PAYEE_UNAVAILABLE(r'PAYEE_UNAVAILABLE'),
@JsonValue(r'ACCOUNT_BLOCKED')
ACCOUNT_BLOCKED(r'ACCOUNT_BLOCKED'),
@JsonValue(r'PAYEE_BANK_REJECTED')
PAYEE_BANK_REJECTED(r'PAYEE_BANK_REJECTED'),
@JsonValue(r'unknown_default_open_api')
unknownDefaultOpenApi(r'unknown_default_open_api');

const PixScheduleOccurrenceFailureReasonEnum(this.value);

final String value;

@override
String toString() => value;
}


