import 'dart:math';

/// Whether [cpf] is a valid CPF, with the same rule as the API: only digits
/// or the usual 000.000.000-00 punctuation, correct check digits, and not
/// all digits repeated.
bool isValidCpf(String cpf) {
  if (!_acceptedFormat.hasMatch(cpf)) return false;
  final digits = cpf.replaceAll(_nonDigits, '');
  // Repeated digits pass the check digit math but are never issued.
  if (_repeatedDigits.hasMatch(digits)) return false;
  final numbers = [for (final unit in digits.codeUnits) unit - _zero];
  return _checkDigit(numbers.sublist(0, 9)) == numbers[9] &&
      _checkDigit(numbers.sublist(0, 10)) == numbers[10];
}

/// A valid CPF drawn at random for the public demo (DEMO-01), as 11 digits:
/// the visitor never types their own. A draw can match someone's number by
/// chance, but nothing links it to that person.
String fictitiousCpf(Random random) {
  while (true) {
    final base = [for (var i = 0; i < 9; i++) random.nextInt(10)];
    final first = _checkDigit(base);
    final cpf = [
      ...base,
      first,
      _checkDigit([...base, first]),
    ].join();
    if (isValidCpf(cpf)) return cpf;
  }
}

/// The 11 [digits] with the usual punctuation, for display.
String formatCpf(String digits) =>
    '${digits.substring(0, 3)}.${digits.substring(3, 6)}.'
    '${digits.substring(6, 9)}-${digits.substring(9)}';

final RegExp _acceptedFormat = RegExp(
  r'^(?:\d{11}|\d{3}\.\d{3}\.\d{3}-\d{2})$',
);
final RegExp _repeatedDigits = RegExp(r'^(\d)\1{10}$');
final RegExp _nonDigits = RegExp(r'\D');
const int _zero = 0x30;

// Weighted sum from (length + 1) down to 2, modulo 11; remainders below 2
// give 0.
int _checkDigit(List<int> numbers) {
  var sum = 0;
  for (var i = 0; i < numbers.length; i++) {
    sum += numbers[i] * (numbers.length + 1 - i);
  }
  final remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}
