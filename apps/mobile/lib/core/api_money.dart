import 'package:next_bank/core/api_failure.dart';
import 'package:nextbank_api/nextbank_api.dart' as api;

/// The cents of a [money] the API sent, only in reais (ADR 0006, F-18). The
/// generated client takes a currency it does not know as an unknown value,
/// so every read of money checks it here: the app never shows an amount in
/// another currency as if it were reais.
int reaisCentsOf(api.Money money) {
  if (money.currency != api.MoneyCurrencyEnum.BRL) throw const ApiUnexpected();
  return money.amount;
}
