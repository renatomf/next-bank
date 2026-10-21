import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/top_up/domain/phone_number.dart';

// The number of a top-up, with the same rule as the API: only the made-up
// range (DD) 90000-XXXX, so no one recharges a real line (TOP-01, R1). The
// app checks it to say so early; the server still decides.
void main() {
  for (final typed in [
    '(11) 90000-0001',
    '11 90000-0001',
    '11900000001',
    '(21)90000-1234',
  ]) {
    test('takes a made-up number as typed: $typed', () {
      expect(PhoneNumber.parse(typed), isNotNull);
    });
  }

  for (final (name, typed) in [
    ('a real-looking number', '(11) 98765-4321'),
    ('an area code not in use', '(20) 90000-0001'),
    ('too few digits', '(11) 90000-001'),
    ('too many digits', '(11) 90000-00012'),
    ('letters', '(11) 90000-00a1'),
    ('digits of another script', '(١١) 90000-0001'),
    ('nothing', ''),
  ]) {
    test('refuses $name', () {
      expect(PhoneNumber.parse(typed), isNull);
    });
  }

  test('keeps the eleven digits to send', () {
    expect(PhoneNumber.parse('(11) 90000-0001')?.digits, '11900000001');
  });

  // What the receipt and the statement show, as the server masks it.
  test('masks all but the area code and the last four digits', () {
    expect(PhoneNumber.parse('11900000001')?.masked, '(11) *****-0001');
  });
}
