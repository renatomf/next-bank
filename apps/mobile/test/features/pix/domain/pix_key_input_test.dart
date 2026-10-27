import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/pix_key_input.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

// The key a customer types, told by its shape (v1.2.0 plan, task 5, A1):
// no type picker, as banks do. A value no key can have is refused here and
// never reaches the API, so it spends none of the lookups (PIX-07). Made-up
// keys only.
void main() {
  group('pixKeyOf', () {
    test('takes a valid CPF, with or without its punctuation', () {
      expect(pixKeyOf('123.456.789-09'), (
        type: PixKeyType.cpf,
        value: '12345678909',
      ));
      expect(pixKeyOf(' 12345678909 '), (
        type: PixKeyType.cpf,
        value: '12345678909',
      ));
    });

    test('takes an e-mail, in lowercase', () {
      expect(pixKeyOf(' Clara.Aurora@Example.com '), (
        type: PixKeyType.email,
        value: 'clara.aurora@example.com',
      ));
    });

    test('takes a random key, in lowercase', () {
      expect(pixKeyOf('3F6C2A7E-9B41-4D5A-8E2F-1C7B9D0A4E63'), (
        type: PixKeyType.random,
        value: '3f6c2a7e-9b41-4d5a-8e2f-1c7b9d0a4e63',
      ));
    });

    // 11 digits that are not a valid CPF are a mobile number with its DDD.
    test('takes a phone with its area code, with or without +55', () {
      for (final typed in [
        '(11) 90000-9001',
        '11 90000-9001',
        '+55 11 90000-9001',
        '11900009001',
      ]) {
        expect(pixKeyOf(typed), (
          type: PixKeyType.phone,
          value: '+5511900009001',
        ), reason: typed);
      }
      expect(pixKeyOf('(11) 3333-4444'), (
        type: PixKeyType.phone,
        value: '+551133334444',
      ));
    });

    for (final (name, typed) in [
      ('nothing', '   '),
      ('an e-mail without a domain', 'clara@'),
      ('an e-mail with blanks inside', 'clara aurora@example.com'),
      ('an e-mail longer than 77 characters', '${'a' * 70}@example.com'),
      ('a CPF with a wrong check digit and too few digits', '123.456.789-0'),
      ('a phone without the area code', '90000-9001'),
      ('a phone of another country', '+1 212 555 0100'),
      ('an area code that does not exist', '(01) 90000-9001'),
      ('letters among the digits', '11 9000O-9001'),
      ('a UUID that is not v4', '019a0b6e-7c3d-7f00-8a1b-2c3d4e5f6a7b'),
    ]) {
      test('refuses $name', () {
        expect(pixKeyOf(typed), isNull);
      });
    }
  });
}
