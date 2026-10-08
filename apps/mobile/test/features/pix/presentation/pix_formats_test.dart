import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_formats.dart';

import '../../../support/fake_pix_repository.dart';

// How the Pix screens and the receipt write dates, accounts and payees
// (comprovante-dark mockup; brief, section 7).
void main() {
  group('receiptDate', () {
    test('day, short month, year and time', () {
      expect(receiptDate(DateTime(2026, 10, 5, 14, 32)), '5 out 2026 · 14:32');
    });

    test('pads the hour and the minutes', () {
      expect(receiptDate(DateTime(2026, 1, 9, 7, 5)), '9 jan 2026 · 07:05');
    });

    for (final (month, name) in [
      (1, 'jan'),
      (2, 'fev'),
      (3, 'mar'),
      (4, 'abr'),
      (5, 'mai'),
      (6, 'jun'),
      (7, 'jul'),
      (8, 'ago'),
      (9, 'set'),
      (10, 'out'),
      (11, 'nov'),
      (12, 'dez'),
    ]) {
      test('month $month is "$name"', () {
        expect(receiptDate(DateTime(2026, month, 1)), '1 $name 2026 · 00:00');
      });
    }

    // The server sends UTC; the customer reads their own clock.
    test('shows a UTC instant in local time', () {
      final instant = DateTime.utc(2026, 10, 8, 17, 32);

      expect(receiptDate(instant), receiptDate(instant.toLocal()));
    });
  });

  // Brief, section 7: an account shows only its last four digits.
  test('payerDetail shows the branch and the last four digits', () {
    expect(
      payerDetail(branch: '0001', number: '100000-4'),
      'next bank · Ag 0001 · CC •••• 0004',
    );
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
