/// A mobile number a top-up goes to, with the same rule as the API: only the
/// made-up range (DD) 90000-XXXX, so no one recharges a real person's line,
/// not even by mistake (TOP-01, DEMO-01, decision R1).
final class PhoneNumber {
  const new _(this.digits);

  /// The number as people type it, spaces, brackets and dashes dropped; null
  /// when it is not a made-up number.
  static PhoneNumber? parse(String typed) {
    final digits = typed.replaceAll(_separators, '');
    final match = _madeUp.firstMatch(digits);
    if (match == null || !_areaCodes.contains(int.parse(match[1]!))) {
      return null;
    }
    return PhoneNumber._(digits);
  }

  /// The eleven digits, sent to the server and never logged (MOB-02).
  final String digits;

  /// The area code and the last four digits, as every screen shows it.
  String get masked =>
      '(${digits.substring(0, 2)}) *****-${digits.substring(7)}';
}

final RegExp _separators = RegExp(r'[\s()-]');

// ASCII digits only, as the API: an area code, then 9 0000 and four digits.
final RegExp _madeUp = RegExp(r'^([0-9]{2})90000[0-9]{4}$');

// Brazil's area codes (DDD) in use, by Anatel's numbering plan, as the API.
const Set<int> _areaCodes = {
  ...[11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28],
  ...[31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49],
  ...[51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69],
  ...[71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88, 89],
  ...[91, 92, 93, 94, 95, 96, 97, 98, 99],
};
