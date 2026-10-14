import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';

// The static Pix BR Code (Bacen, Manual de Padrões para Iniciação do Pix;
// EMV-MPM), built in the app from the customer's random key (v1.1.0 plan,
// task 3; D3). It never carries the CPF (PIX-12). Fictitious data only.
const _key = '11111111-2222-4333-8444-555555555555';

/// Reads EMV fields (two-digit id, two-digit length, value) into a map.
Map<String, String> _fields(String payload) {
  final fields = <String, String>{};
  var i = 0;
  while (i < payload.length) {
    final id = payload.substring(i, i + 2);
    final length = int.parse(payload.substring(i + 2, i + 4));
    fields[id] = payload.substring(i + 4, i + 4 + length);
    i += 4 + length;
  }
  return fields;
}

void main() {
  group('crc16Ccitt', () {
    // The check value of CRC-16/CCITT-FALSE.
    test('gives 29B1 for "123456789"', () {
      expect(crc16Ccitt('123456789'), '29B1');
    });

    // The example of the Bacen's manual, CRC included.
    test("matches the Bacen manual's example", () {
      expect(
        crc16Ccitt(
          '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000'
          '5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304',
        ),
        '1D3D',
      );
    });
  });

  group('staticBrCode', () {
    test('carries the key, the name and the fixed fields, in order', () {
      final payload = staticBrCode(key: _key, receiverName: 'Bruno Lima');

      expect(
        payload,
        startsWith(
          [
            '000201',
            '26580014br.gov.bcb.pix0136$_key',
            '52040000',
            '5303986',
            '5802BR',
            '5910BRUNO LIMA',
            '6009SAO PAULO',
            '62070503***',
            '6304',
          ].join(),
        ),
      );
    });

    test('ends with the CRC of everything before it', () {
      final payload = staticBrCode(key: _key, receiverName: 'Bruno Lima');

      final body = payload.substring(0, payload.length - 4);
      expect(payload.substring(payload.length - 4), crc16Ccitt(body));
    });

    test(
      'carries an amount in reais with two decimals, from integer cents',
      () {
        for (final (cents, text) in [
          (1, '0.01'),
          (1050, '10.50'),
          (35000, '350.00'),
          (999999999, '9999999.99'),
        ]) {
          final payload = staticBrCode(
            key: _key,
            receiverName: 'Bruno Lima',
            amountCents: cents,
          );

          expect(_fields(payload)['54'], text, reason: '$cents cents');
        }
      },
    );

    test('leaves the amount out when there is none, so the payer types it', () {
      final payload = staticBrCode(key: _key, receiverName: 'Bruno Lima');

      expect(_fields(payload).containsKey('54'), isFalse);
    });

    test('refuses an amount below one cent', () {
      expect(
        () => staticBrCode(key: _key, receiverName: 'Bruno', amountCents: 0),
        throwsArgumentError,
      );
    });

    test('carries the message inside the merchant account field', () {
      final payload = staticBrCode(
        key: _key,
        receiverName: 'Bruno Lima',
        message: 'Almoço de sexta',
      );

      expect(
        _fields(payload)['26'],
        '0014br.gov.bcb.pix0136${_key}0215Almoco de sexta',
      );
    });

    test('leaves a blank message out', () {
      final payload = staticBrCode(
        key: _key,
        receiverName: 'Bruno Lima',
        message: '   ',
      );

      expect(_fields(payload)['26'], '0014br.gov.bcb.pix0136$_key');
    });

    // Field 26 holds 99 characters; with a 36-character key, 37 are left.
    test('takes a message of up to $maxBrCodeMessageLength characters', () {
      final message = 'a' * maxBrCodeMessageLength;

      final payload = staticBrCode(
        key: _key,
        receiverName: 'Bruno',
        message: message,
      );

      expect(_fields(payload)['26'], hasLength(99));
      expect(
        () => staticBrCode(
          key: _key,
          receiverName: 'Bruno',
          message: '${message}a',
        ),
        throwsArgumentError,
      );
    });

    test('refuses a message with characters outside the code', () {
      expect(
        () =>
            staticBrCode(key: _key, receiverName: 'Bruno', message: 'pizza 🍕'),
        throwsArgumentError,
      );
    });

    test(
      'writes the name without accents, in capitals, up to 25 characters',
      () {
        final payload = staticBrCode(
          key: _key,
          receiverName: 'Conceição  Araújo de Magalhães Brandão',
        );

        expect(_fields(payload)['59'], 'CONCEICAO ARAUJO DE MAGAL');
      },
    );

    test('never carries a CPF: only a random key goes in (PIX-12)', () {
      expect(
        () => staticBrCode(key: '12345678909', receiverName: 'Bruno'),
        throwsArgumentError,
      );
    });

    test('is the same for the same inputs', () {
      String build() => staticBrCode(
        key: _key,
        receiverName: 'Bruno Lima',
        amountCents: 2500,
        message: 'Pizza',
      );

      expect(build(), build());
    });
  });

  group('brCodeMessageText', () {
    test('drops accents and the blanks around the message', () {
      expect(brCodeMessageText('  Pão de queijo  '), 'Pao de queijo');
    });
  });
}
