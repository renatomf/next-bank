import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/send/send_pix_controller.dart';

import '../../../../support/fake_pix_repository.dart';

// Valid and invalid CPFs made up for the tests.
const _cpf = '52998224725';
const _otherCpf = '11144477735';

(ProviderContainer, FakePixRepository) setUpSend() {
  final repository = FakePixRepository();
  final container = ProviderContainer(
    overrides: [
      pixRepositoryProvider.overrideWithValue(repository),
      idempotencyKeysProvider.overrideWithValue(sequentialKeys()),
    ],
  );
  addTearDown(container.dispose);
  container.listen(sendPixControllerProvider, (_, _) {});
  return (container, repository);
}

SendPixController controllerOf(ProviderContainer container) =>
    container.read(sendPixControllerProvider.notifier);

SendPixState stateOf(ProviderContainer container) =>
    container.read(sendPixControllerProvider);

/// A draft ready to send: R$ 350,00 to Mariana's CPF key.
Future<SendPixController> readyDraft(ProviderContainer container) async {
  final controller = controllerOf(container)
    ..typeAmount('35000')
    ..typeKey(_cpf)
    ..typeDescription('Aluguel de outubro');
  await controller.lookup();
  return controller;
}

// Screen 7 (domain-model.md 11): typing, looking up the key, key found,
// PixKeyNotFound, SamePayerAndPayee, InsufficientFunds, LimitExceeded,
// AccountBlocked.
void main() {
  group('the amount', () {
    test('starts at zero and cannot be sent', () {
      final (container, _) = setUpSend();

      expect(stateOf(container).amountCents, 0);
      expect(stateOf(container).canSubmit, isFalse);
    });

    test('is the digits typed, in cents (ADR 0006)', () {
      final (container, _) = setUpSend();

      controllerOf(container).typeAmount('35000');

      expect(stateOf(container).amountCents, 35000);
    });

    test('ignores what is not up to nine digits', () {
      final (container, _) = setUpSend();

      controllerOf(container)
        ..typeAmount('350')
        ..typeAmount('3,50')
        ..typeAmount('1234567890');

      expect(stateOf(container).amountCents, 350);
    });
  });

  group('the key lookup', () {
    // PIX-07: an invalid CPF never spends a lookup.
    test('refuses an invalid CPF without asking the API', () async {
      final (container, repository) = setUpSend();
      final controller = controllerOf(container)..typeKey('12345678900');

      await controller.lookup();

      expect(stateOf(container).keyError, 'CPF inválido.');
      expect(repository.calls, isEmpty);
    });

    test('shows who holds a valid CPF key', () async {
      final (container, repository) = setUpSend();
      final controller = controllerOf(container)..typeKey('529.982.247-25');

      await controller.lookup();

      expect(repository.callsOf('lookup').single.key, (
        type: PixKeyType.cpf,
        value: _cpf,
      ));
      expect(stateOf(container).payee, mariana);
      expect(stateOf(container).keyError, isNull);
    });

    test('says when the key is being looked up', () async {
      final (container, repository) = setUpSend();
      final answer = Completer<PixPayee>();
      repository.lookupAnswer = () => answer.future;
      final controller = controllerOf(container)..typeKey(_cpf);

      final lookup = controller.lookup();
      expect(stateOf(container).searching, isTrue);
      answer.complete(mariana);
      await lookup;

      expect(stateOf(container).searching, isFalse);
    });

    test('says when the key does not exist', () async {
      final (container, repository) = setUpSend();
      repository.lookupAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.pixKeyNotFound);
      final controller = controllerOf(container)..typeKey(_cpf);

      await controller.lookup();

      expect(stateOf(container).keyError, 'Não encontramos essa chave Pix.');
      expect(stateOf(container).payee, isNull);
    });

    test('asks once while a lookup runs', () async {
      final (container, repository) = setUpSend();
      final answer = Completer<PixPayee>();
      repository.lookupAnswer = () => answer.future;
      final controller = controllerOf(container)..typeKey(_cpf);

      final first = controller.lookup();
      final second = controller.lookup();
      answer.complete(mariana);
      await Future.wait([first, second]);

      expect(repository.callsOf('lookup'), hasLength(1));
    });

    test('forgets the payee when the key changes', () async {
      final (container, _) = setUpSend();
      final controller = await readyDraft(container);

      controller.typeKey(_otherCpf);

      expect(stateOf(container).payee, isNull);
      expect(stateOf(container).canSubmit, isFalse);
    });

    test('drops the answer for a key that was changed meanwhile', () async {
      final (container, repository) = setUpSend();
      final answer = Completer<PixPayee>();
      repository.lookupAnswer = () => answer.future;
      final controller = controllerOf(container)..typeKey(_cpf);

      final lookup = controller.lookup();
      controller.typeKey(_otherCpf);
      answer.complete(mariana);
      await lookup;

      expect(stateOf(container).payee, isNull);
    });
  });

  group('sending', () {
    test('creates the Pix and gives its id for the review', () async {
      final (container, repository) = setUpSend();
      final controller = await readyDraft(container);

      final transferId = await controller.submit();

      final create = repository.callsOf('create').single;
      expect(create.key, (type: PixKeyType.cpf, value: _cpf));
      expect(create.amountCents, 35000);
      expect(create.description, 'Aluguel de outubro');
      expect(create.idempotencyKey, 'key-1');
      expect(transferId, 'pix-1');
    });

    test('sends no description when it is blank', () async {
      final (container, repository) = setUpSend();
      final controller = await readyDraft(container);
      controller.typeDescription('   ');

      await controller.submit();

      expect(repository.callsOf('create').single.description, isNull);
    });

    for (final (name, change) in <(String, void Function(SendPixController))>[
      ('without an amount', (c) => c.typeAmount('')),
      ('without a found payee', (c) => c.typeKey(_otherCpf)),
      (
        'with a description over 140 characters',
        (c) => c.typeDescription('a' * 141),
      ),
    ]) {
      test('cannot send $name', () async {
        final (container, repository) = setUpSend();
        final controller = await readyDraft(container);
        change(controller);

        expect(stateOf(container).canSubmit, isFalse);
        expect(await controller.submit(), isNull);
        expect(repository.callsOf('create'), isEmpty);
      });
    }

    // PIX-08 on the app side: a double tap creates one Pix.
    test('sends once while a creation runs', () async {
      final (container, repository) = setUpSend();
      final answer = Completer<PixTransfer>();
      repository.createAnswer = () => answer.future;
      final controller = await readyDraft(container);

      final first = controller.submit();
      expect(stateOf(container).submitting, isTrue);
      final second = controller.submit();
      answer.complete(pixTransfer());
      await Future.wait([first, second]);

      expect(repository.callsOf('create'), hasLength(1));
      expect(stateOf(container).submitting, isFalse);
    });

    for (final (failure, message) in [
      (
        const ApiRejected(ApiErrorCode.samePayerAndPayee),
        'Você não pode enviar Pix para a própria conta.',
      ),
      (
        const ApiRejected(ApiErrorCode.insufficientFunds),
        'Saldo insuficiente.',
      ),
      (
        const ApiRejected(ApiErrorCode.limitExceeded, limitCents: 100000),
        r'Valor acima do seu limite de R$ 1.000,00 por Pix.',
      ),
      (
        const ApiRejected(ApiErrorCode.accountBlocked),
        'Sua conta está bloqueada. Fale com o suporte.',
      ),
    ]) {
      test('says why a Pix was refused: ${failure.code.wire}', () async {
        final (container, repository) = setUpSend();
        repository.createAnswer = () async => throw failure;
        final controller = await readyDraft(container);

        expect(await controller.submit(), isNull);
        expect(stateOf(container).error, message);
      });
    }
  });

  // MOB-07: a creation whose answer was lost is repeated with its key, so the
  // server answers with the same Pix instead of creating another.
  group('the idempotency key', () {
    test('is kept when the same draft is sent again after no answer', () async {
      final (container, repository) = setUpSend();
      repository.createAnswer = () async => throw const ApiUnreachable();
      final controller = await readyDraft(container);

      await controller.submit();
      expect(stateOf(container).error, 'Sem conexão. Tente de novo.');
      repository.createAnswer = () async => pixTransfer();
      await controller.submit();

      expect(repository.callsOf('create').map((call) => call.idempotencyKey), [
        'key-1',
        'key-1',
      ]);
    });

    test('is kept after a server error, whose outcome is unknown', () async {
      final (container, repository) = setUpSend();
      repository.createAnswer = () async => throw const ApiUnexpected();
      final controller = await readyDraft(container);

      await controller.submit();
      await controller.submit();

      expect(repository.callsOf('create').map((call) => call.idempotencyKey), [
        'key-1',
        'key-1',
      ]);
    });

    for (final (name, change) in <(String, void Function(SendPixController))>[
      ('the amount', (c) => c.typeAmount('36000')),
      ('the description', (c) => c.typeDescription('Aluguel de novembro')),
    ]) {
      test('is new when $name changes', () async {
        final (container, repository) = setUpSend();
        repository.createAnswer = () async => throw const ApiUnreachable();
        final controller = await readyDraft(container);

        await controller.submit();
        change(controller);
        await controller.submit();

        expect(
          repository.callsOf('create').map((call) => call.idempotencyKey),
          ['key-1', 'key-2'],
        );
      });
    }

    // A key whose answer came back is spent: reusing it would bring back the
    // same Pix, possibly expired, forever.
    test('is new after the server answered', () async {
      final (container, repository) = setUpSend();
      final controller = await readyDraft(container);

      await controller.submit();
      repository.createAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.insufficientFunds);
      await controller.submit();
      await controller.submit();

      expect(repository.callsOf('create').map((call) => call.idempotencyKey), [
        'key-1',
        'key-2',
        'key-3',
      ]);
    });
  });

  // Paying by QR Code (v1.1.0 plan, task 4): the code fills the Pix; the
  // name shown is the server's (PIX-11) and a fixed amount is locked (PIX-13).
  group('a QR Code', () {
    String brunosCode({int? amountCents, String? message}) => staticBrCode(
      key: brunoReceivingKey,
      receiverName: 'Loja Falsa',
      amountCents: amountCents,
      message: message,
    );
    const randomKey = (type: PixKeyType.random, value: brunoReceivingKey);

    test('fills the key, the fixed amount and the message, and looks the '
        'key up', () async {
      final (container, repository) = setUpSend();

      final error = await controllerOf(container)
          .readQrCode(brunosCode(amountCents: 2500, message: 'Pizza'));

      final state = stateOf(container);
      expect(error, isNull);
      expect(repository.callsOf('lookup').single.key, randomKey);
      expect(state.amountCents, 2500);
      expect(state.amountLocked, isTrue);
      expect(state.description, 'Pizza');
      // The name of the code ("LOJA FALSA") is never shown (PIX-11).
      expect(state.payee, mariana);
    });

    test('leaves the amount to the payer when the code has none', () async {
      final (container, _) = setUpSend();
      controllerOf(container).typeAmount('1000');

      await controllerOf(container).readQrCode(brunosCode());

      expect(stateOf(container).amountCents, 1000);
      expect(stateOf(container).amountLocked, isFalse);
    });

    test('keeps a fixed amount from being typed over (PIX-13)', () async {
      final (container, _) = setUpSend();
      await controllerOf(container).readQrCode(brunosCode(amountCents: 2500));

      controllerOf(container).typeAmount('99999');

      expect(stateOf(container).amountCents, 2500);
    });

    test('sends the Pix to the random key, with the fixed amount', () async {
      final (container, repository) = setUpSend();
      await controllerOf(container).readQrCode(brunosCode(amountCents: 2500));

      await controllerOf(container).submit();

      final create = repository.callsOf('create').single;
      expect(create.key, randomKey);
      expect(create.amountCents, 2500);
    });

    test('gives way to a CPF typed afterwards, unlocking the amount', () async {
      final (container, _) = setUpSend();
      await controllerOf(container).readQrCode(brunosCode(amountCents: 2500));

      controllerOf(container)
        ..typeKey(_cpf)
        ..typeAmount('35000');

      expect(stateOf(container).amountLocked, isFalse);
      expect(stateOf(container).amountCents, 35000);
      expect(stateOf(container).payee, isNull);
    });

    test('refuses a changed code without asking the server', () async {
      final (container, repository) = setUpSend();
      final valid = brunosCode(amountCents: 2500);

      final error = await controllerOf(container)
          .readQrCode(valid.replaceFirst('25.00', '95.00'));

      expect(error, 'Este QR Code não é um Pix válido.');
      expect(repository.callsOf('lookup'), isEmpty);
      expect(stateOf(container).amountCents, 0);
    });

    test(
      'says when the key is of a kind the next bank does not take',
      () async {
        final (container, repository) = setUpSend();
        String field(String id, String value) =>
            '$id${value.length.toString().padLeft(2, '0')}$value';
        final body = [
          field('00', '01'),
          field(
            '26',
            field('00', 'br.gov.bcb.pix') + field('01', 'loja@example.test'),
          ),
          field('52', '0000'),
          field('53', '986'),
          field('58', 'BR'),
          field('59', 'LOJA'),
          field('60', 'SAO PAULO'),
          field('62', field('05', '***')),
        ].join();
        final code = '${body}6304${crc16Ccitt('${body}6304')}';

        final error = await controllerOf(container).readQrCode(code);

        expect(
          error,
          'Este QR Code usa uma chave que o next bank ainda não aceita.',
        );
        expect(repository.callsOf('lookup'), isEmpty);
      },
    );

    // The camera reports the same code many times a second.
    test('reads one code at a time', () async {
      final (container, repository) = setUpSend();
      final answer = Completer<PixPayee>();
      repository.lookupAnswer = () => answer.future;

      final first = controllerOf(container).readQrCode(brunosCode());
      final second = controllerOf(container).readQrCode(brunosCode());
      answer.complete(mariana);
      await Future.wait<String?>([first, second]);

      expect(repository.callsOf('lookup'), hasLength(1));
    });
  });
}
