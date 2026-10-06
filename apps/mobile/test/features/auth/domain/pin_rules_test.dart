import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/auth/domain/pin_rules.dart';

// Mirrors the API's Pin (domain-model.md 3.1): the same cases as its tests,
// so the app never sends a PIN the API would refuse.
void main() {
  group('isAcceptablePin', () {
    for (final pin in ['2580', '0192']) {
      test('accepts $pin', () => expect(isAcceptablePin(pin), isTrue));
    }

    for (final (name, pin) in [
      ('repeated digits', '0000'),
      ('repeated digits', '7777'),
      ('an ascending sequence', '1234'),
      ('an ascending sequence', '6789'),
      ('a descending sequence', '4321'),
      ('a descending sequence', '9876'),
      ('3 digits', '123'),
      ('5 digits', '25801'),
      ('letters', '25a0'),
      ('spaces', ' 2580'),
      ('non-ASCII digits', '٢٥٨٠'),
    ]) {
      test('rejects $name: "$pin"', () {
        expect(isAcceptablePin(pin), isFalse);
      });
    }
  });
}
