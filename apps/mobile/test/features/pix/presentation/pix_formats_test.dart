import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';

import '../../../support/fake_pix_repository.dart';

// How the Pix screens and the receipt write dates, accounts and payees
// (comprovante-dark mockup; brief, section 7).
void main() {
  // v1.1.0 plan, task 1: the shared receipt writes the date in full.
  group('receiptLongDate', () {
    test('weekday, day, month and year in full, then the time', () {
      expect(
        receiptLongDate(DateTime(2026, 9, 30, 14, 9)),
        'quarta-feira, 30 de setembro de 2026, 14:09',
      );
    });

    for (final (day, weekday) in [
      (5, 'segunda-feira'),
      (6, 'terça-feira'),
      (7, 'quarta-feira'),
      (8, 'quinta-feira'),
      (9, 'sexta-feira'),
      (10, 'sábado'),
      (11, 'domingo'),
    ]) {
      test('October $day, 2026 is a $weekday', () {
        expect(
          receiptLongDate(DateTime(2026, 10, day, 8)),
          '$weekday, $day de outubro de 2026, 08:00',
        );
      });
    }

    for (final (month, name) in [
      (1, 'janeiro'),
      (2, 'fevereiro'),
      (3, 'março'),
      (4, 'abril'),
      (5, 'maio'),
      (6, 'junho'),
      (7, 'julho'),
      (8, 'agosto'),
      (9, 'setembro'),
      (10, 'outubro'),
      (11, 'novembro'),
      (12, 'dezembro'),
    ]) {
      test('month $month is "$name"', () {
        expect(receiptLongDate(DateTime(2026, month)), contains(' de $name '));
      });
    }

    test('shows a UTC instant in local time', () {
      final instant = DateTime.utc(2026, 10, 8, 17, 32);

      expect(receiptLongDate(instant), receiptLongDate(instant.toLocal()));
    });
  });

  // The receipt shows who receives by their initials, as in the reference.
  group('nameInitials', () {
    for (final (name, initials) in [
      ('Mariana Costa', 'MC'),
      ('Eliane Angelica De Lima Profitti', 'EP'),
      ('Bruno', 'B'),
      ('ana  souza ', 'AS'),
      ('', ''),
    ]) {
      test('"$name" is "$initials"', () {
        expect(nameInitials(name), initials);
      });
    }
  });

  test('payeeDetail shows the masked document as the server sent it', () {
    expect(payeeDetail(mariana), 'CPF ***.456.789-** · next bank');
  });

  group('pixType', () {
    for (final (type, text) in [
      (PixKeyType.cpf, 'Pix · Chave CPF'),
      (PixKeyType.email, 'Pix · Chave e-mail'),
      (PixKeyType.phone, 'Pix · Chave celular'),
      (PixKeyType.random, 'Pix · Chave aleatória'),
    ]) {
      test(type.name, () {
        expect(pixType(type), text);
      });
    }
  });
}
