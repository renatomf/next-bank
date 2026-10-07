//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:nextbank_api/src/model/money.dart';
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'my_account.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MyAccount {
  /// Returns a new [MyAccount] instance.
  MyAccount({

    required  this.branch,

    required  this.number,

    required  this.status,

    required  this.availableBalance,
  });

  @JsonKey(
    
    name: r'branch',
    required: true,
    includeIfNull: false,
  )


  final String branch;



  @JsonKey(
    
    name: r'number',
    required: true,
    includeIfNull: false,
  )


  final String number;



  @JsonKey(
    
    name: r'status',
    required: true,
    includeIfNull: false,
  )


  final MyAccountStatusEnum status;



  @JsonKey(
    
    name: r'availableBalance',
    required: true,
    includeIfNull: false,
  )


  final Money availableBalance;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MyAccount &&
      other.branch == branch &&
      other.number == number &&
      other.status == status &&
      other.availableBalance == availableBalance;

    @override
    int get hashCode =>
        branch.hashCode +
        number.hashCode +
        status.hashCode +
        availableBalance.hashCode;

  factory MyAccount.fromJson(Map<String, dynamic> json) => _$MyAccountFromJson(json);

  Map<String, dynamic> toJson() => _$MyAccountToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum MyAccountStatusEnum {
@JsonValue(r'ACTIVE')
ACTIVE(r'ACTIVE'),
@JsonValue(r'BLOCKED')
BLOCKED(r'BLOCKED'),
@JsonValue(r'CLOSED')
CLOSED(r'CLOSED');

const MyAccountStatusEnum(this.value);

final String value;

@override
String toString() => value;
}


