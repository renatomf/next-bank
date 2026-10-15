import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

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

  parseBrCodeTests();

  group('brCodeMessageText', () {
    test('drops accents and the blanks around the message', () {
      expect(brCodeMessageText('  Pão de queijo  '), 'Pao de queijo');
    });
  });
}

/// [body] closed with field 63 and its CRC, as any bank would emit it.
String _withCrc(String body) => '${body}6304${crc16Ccitt('${body}6304')}';

/// A static code with [key] built field by field, for keys and shapes the
/// next bank never emits itself.
String _code({
  String key = _key,
  String gui = 'br.gov.bcb.pix',
  String? amount,
  String currency = '986',
}) {
  String field(String id, String value) =>
      '$id${value.length.toString().padLeft(2, '0')}$value';
  final account = field('00', gui) + field('01', key);
  return _withCrc(
    [
      field('00', '01'),
      field('26', account),
      field('52', '0000'),
      field('53', currency),
      if (amount != null) field('54', amount),
      field('58', 'BR'),
      field('59', 'LOJA FALSA'),
      field('60', 'SAO PAULO'),
      field('62', field('05', '***')),
    ].join(),
  );
}

// Paying by QR Code (v1.1.0 plan, task 4): the code is checked whole before
// any screen (PIX-13); its name is never read (PIX-11); a code never opens
// anything (MOB-06).
void parseBrCodeTests() {
  group('parseBrCode', () {
    test("reads the key, the amount and the message of a next bank code", () {
      final payment = parseBrCode(
        staticBrCode(
          key: _key,
          receiverName: 'Bruno Lima',
          amountCents: 2500,
          message: 'Pizza de sexta',
        ),
      );

      expect(payment.key, _key);
      expect(payment.keyType, PixKeyType.random);
      expect(payment.amountCents, 2500);
      expect(payment.message, 'Pizza de sexta');
    });

    test('leaves the amount and the message out when the code has none', () {
      final payment = parseBrCode(
        staticBrCode(key: _key, receiverName: 'Bruno Lima'),
      );

      expect(payment.amountCents, isNull);
      expect(payment.message, isNull);
    });

    test("reads the Bacen manual's example, a random key of another bank", () {
      final payment = parseBrCode(
        '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000'
        '5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D',
      );

      expect(payment.key, '123e4567-e12b-12d1-a456-426655440000');
      expect(payment.keyType, PixKeyType.random);
    });

    test('reads a CPF key as digits', () {
      final payment = parseBrCode(_code(key: '52998224725'));

      expect(payment.key, '52998224725');
      expect(payment.keyType, PixKeyType.cpf);
    });

    test('takes the payment arrangement name in any case', () {
      expect(
        parseBrCode(_code(gui: 'BR.GOV.BCB.PIX')).keyType,
        PixKeyType.random,
      );
    });

    test('ignores blanks around a pasted code', () {
      expect(parseBrCode('  ${_code()}\n').key, _key);
    });

    for (final (text, cents) in [
      ('10.50', 1050),
      ('10.5', 1050),
      ('10', 1000),
      ('0.01', 1),
    ]) {
      test('reads the amount "$text" as $cents cents (ADR 0006)', () {
        expect(parseBrCode(_code(amount: text)).amountCents, cents);
      });
    }

    // PIX-13: anything changed without a new CRC, or a code that is not a
    // static Pix, never reaches a screen.
    final valid = _code(amount: '25.00');
    for (final (name, text) in [
      ('an amount changed after the CRC', valid.replaceFirst('25.00', '95.00')),
      ('a key changed after the CRC', valid.replaceFirst('5555', '5556')),
      ('a wrong CRC', '${valid.substring(0, valid.length - 4)}0000'),
      ('no CRC field', valid.substring(0, valid.length - 8)),
      ('a length longer than the text', '000201260'),
      ('a length that is not digits', _withCrc('0002AB')),
      ('another payload format', _withCrc('000202')),
      ('another payment arrangement', _code(gui: 'br.com.other')),
      ('a currency other than the real', _code(currency: '840')),
      ('an amount of zero', _code(amount: '0.00')),
      ('an amount with three decimals', _code(amount: '1.505')),
      ('an amount that is not a number', _code(amount: '1e3')),
      ('a CPF with a wrong check digit', _code(key: '52998224700')),
      ('a link (MOB-06)', 'https://example.test/pix'),
      ('plain text', 'Pizza'),
      ('nothing', ''),
    ]) {
      test('refuses $name (InvalidQrCode)', () {
        expect(() => parseBrCode(text), throwsA(isA<InvalidQrCode>()));
      });
    }

    test('refuses a dynamic code, which carries a URL instead of a key', () {
      String field(String id, String value) =>
          '$id${value.length.toString().padLeft(2, '0')}$value';
      final dynamicCode = _withCrc(
        [
          field('00', '01'),
          field('01', '12'),
          field(
            '26',
            field('00', 'br.gov.bcb.pix') +
                field('25', 'pix.example.test/qr/1'),
          ),
          field('52', '0000'),
          field('53', '986'),
          field('58', 'BR'),
          field('59', 'LOJA'),
          field('60', 'SAO PAULO'),
          field('62', field('05', '***')),
        ].join(),
      );

      expect(() => parseBrCode(dynamicCode), throwsA(isA<InvalidQrCode>()));
    });

    // The next bank registers only CPF and random keys.
    for (final (name, key) in [
      ('an e-mail', 'loja@example.test'),
      ('a phone', '+5511999990000'),
      ('a CNPJ', '11222333000181'),
    ]) {
      test('says the next bank does not take $name key yet', () {
        expect(
          () => parseBrCode(_code(key: key)),
          throwsA(isA<UnsupportedPixKey>()),
        );
      });
    }

    test('never carries what it read in the error (MOB-02)', () {
      try {
        parseBrCode(_code(amount: '1e3'));
        fail('should refuse');
      } on InvalidQrCode catch (error) {
        expect(error.toString(), isNot(contains(_key)));
      }
    });
  });
}
