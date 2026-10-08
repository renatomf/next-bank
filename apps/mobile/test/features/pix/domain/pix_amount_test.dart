import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/pix_amount.dart';

// The amount is typed right to left, as on an ATM, and is integer cents from
// the first keystroke: never a double (ADR 0006; PIX-04).
void main() {
  group('centsFromDigits', () {
    for (final (digits, cents) in [
      ('', 0),
      ('3', 3),
      ('35', 35),
      ('350', 350),
      ('35000', 35000),
      ('0035000', 35000),
      ('999999999', 999999999),
    ]) {
      test('"$digits" is $cents cents', () {
        expect(centsFromDigits(digits), cents);
      });
    }

    test('refuses more than $maxAmountDigits digits', () {
      expect(centsFromDigits('1234567890'), isNull);
    });

    for (final typed in ['1,50', '1.50', '-5', '1e3', ' 5', '٣']) {
      test('refuses anything but digits: "$typed"', () {
        expect(centsFromDigits(typed), isNull);
      });
    }
  });

  group('isSendableAmount', () {
    test('zero is not sent', () {
      expect(isSendableAmount(0), isFalse);
    });

    test('one cent is the minimum (domain-model.md, section 7)', () {
      expect(isSendableAmount(1), isTrue);
    });
  });
}
