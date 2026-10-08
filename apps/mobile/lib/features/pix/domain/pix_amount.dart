/// Most digits the amount field takes: up to R$ 9.999.999,99, far above any
/// limit, so the server's limits are the ones that refuse (PIX-10).
const int maxAmountDigits = 9;

final RegExp _digitsOnly = RegExp(r'^[0-9]*$');

/// The amount the customer typed, right to left as on an ATM ("35000" is
/// R$ 350,00), in integer cents from the first keystroke: never a double
/// (ADR 0006; PIX-04). Null for anything that is not up to
/// [maxAmountDigits] ASCII digits.
int? centsFromDigits(String digits) {
  if (digits.length > maxAmountDigits || !_digitsOnly.hasMatch(digits)) {
    return null;
  }
  return digits.isEmpty ? 0 : int.parse(digits);
}

/// One cent is the least a Pix sends (domain-model.md, section 7).
bool isSendableAmount(int cents) => cents >= 1;
