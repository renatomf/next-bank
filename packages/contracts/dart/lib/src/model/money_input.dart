//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:copy_with_extension/copy_with_extension.dart';
import 'package:json_annotation/json_annotation.dart';

part 'money_input.g.dart';


@CopyWith()
@JsonSerializable(
  checked: true,
  createToJson: true,
  disallowUnrecognizedKeys: false,
  explicitToJson: true,
)
class MoneyInput {
  /// Returns a new [MoneyInput] instance.
  MoneyInput({

    required  this.amount,

    required  this.currency,
  });

      /// Integer amount of cents, e.g. 35000 for R$ 350,00
          // minimum: -9007199254740991
          // maximum: 9007199254740991
  @JsonKey(
    
    name: r'amount',
    required: true,
    includeIfNull: false,
  )


  final int amount;



  @JsonKey(
    
    name: r'currency',
    required: true,
    includeIfNull: false,
  )


  final MoneyInputCurrencyEnum currency;





    @override
    bool operator ==(Object other) => identical(this, other) || other is MoneyInput &&
      other.amount == amount &&
      other.currency == currency;

    @override
    int get hashCode =>
        amount.hashCode +
        currency.hashCode;

  factory MoneyInput.fromJson(Map<String, dynamic> json) => _$MoneyInputFromJson(json);

  Map<String, dynamic> toJson() => _$MoneyInputToJson(this);

  @override
  String toString() {
    return toJson().toString();
  }

}

enum MoneyInputCurrencyEnum {
@JsonValue(r'BRL')
BRL(r'BRL');

const MoneyInputCurrencyEnum(this.value);

final String value;

@override
String toString() => value;
}


