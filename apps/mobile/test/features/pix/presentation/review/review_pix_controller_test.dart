import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/review/review_pix_controller.dart';

import '../../../../support/fake_biometric_pin_store.dart';
import '../../../../support/fake_pix_repository.dart';

const _transferId = 'pix-1';

(ProviderContainer, FakePixRepository) setUpReview({
  FakeBiometricPinStore? biometrics,
}) {
  final repository = FakePixRepository();
  final container = ProviderContainer(
    overrides: [
      biometricPinStoreProvider.overrideWithValue(
        biometrics ?? FakeBiometricPinStore(),
      ),
      pixRepositoryProvider.overrideWithValue(repository),
      idempotencyKeysProvider.overrideWithValue(sequentialKeys()),
    ],
  );
  addTearDown(container.dispose);
  container.listen(reviewPixControllerProvider(_transferId), (_, _) {});
  return (container, repository);
}

ReviewPixController controllerOf(ProviderContainer container) =>
    container.read(reviewPixControllerProvider(_transferId).notifier);

ReviewPixState stateOf(ProviderContainer container) =>
    container.read(reviewPixControllerProvider(_transferId));

List<(String?, String?)> authorizations(FakePixRepository repository) => [
  for (final call in repository.callsOf('authorize'))
    (call.idempotencyKey, call.pin),
];

const _unknownOutcome =
    'Não conseguimos confirmar o Pix. Tente de novo: ele não será enviado '
    'duas vezes.';

// Screen 8 states (domain-model.md 11): summary, typing the PIN, verifying,
// PinIncorrect, PinLocked, TransferExpired. The PIN is checked on the server
// (PIX-06) and is never part of the state (MOB-02).
void main() {
  test('authorizes the Pix with the PIN and the key of the attempt', () async {
    final (container, repository) = setUpReview();

    final transfer = await controllerOf(container).confirm('2580');

    final call = repository.callsOf('authorize').single;
    expect(call.transferId, _transferId);
    expect(call.pin, '2580');
    expect(call.idempotencyKey, 'key-1');
    expect(transfer?.status, PixStatus.completed);
  });

  // PIX-08 on the app side: a double tap is one authorization.
  test('confirms once while an authorization runs', () async {
    final (container, repository) = setUpReview();
    final answer = Completer<PixTransfer>();
    repository.authorizeAnswer = () => answer.future;

    final first = controllerOf(container).confirm('2580');
    expect(stateOf(container).verifying, isTrue);
    final second = controllerOf(container).confirm('2580');
    answer.complete(pixTransfer(status: PixStatus.completed));
    await Future.wait([first, second]);

    expect(repository.callsOf('authorize'), hasLength(1));
    expect(stateOf(container).verifying, isFalse);
  });

  group('a wrong or locked PIN', () {
    test('says how many attempts are left', () async {
      final (container, repository) = setUpReview();
      repository.authorizeAnswer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );

      expect(await controllerOf(container).confirm('7413'), isNull);

      expect(stateOf(container).error, 'PIN incorreto. Restam 4 tentativas.');
      expect(stateOf(container).blocked, isFalse);
    });

    // MOB-07: a new PIN is a new attempt.
    test('a PIN typed again goes with a new key', () async {
      final (container, repository) = setUpReview();
      repository.authorizeAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.pinIncorrect);

      await controllerOf(container).confirm('7413');
      repository.authorizeAnswer = () async =>
          pixTransfer(status: PixStatus.completed);
      await controllerOf(container).confirm('2580');

      expect(authorizations(repository), [
        ('key-1', '7413'),
        ('key-2', '2580'),
      ]);
    });

    for (final code in [
      ApiErrorCode.pinLocked,
      ApiErrorCode.pinResetRequired,
    ]) {
      test('${code.wire} leaves no PIN to type', () async {
        final (container, repository) = setUpReview();
        repository.authorizeAnswer = () async => throw ApiRejected(code);

        await controllerOf(container).confirm('7413');
        await controllerOf(container).confirm('2580');

        expect(stateOf(container).blocked, isTrue);
        expect(repository.callsOf('authorize'), hasLength(1));
      });
    }
  });

  for (final (code, message) in [
    (
      ApiErrorCode.transferExpired,
      'O tempo para confirmar acabou. Comece de novo.',
    ),
    (ApiErrorCode.invalidTransferState, 'Este Pix já foi processado.'),
  ]) {
    test('${code.wire} asks to start again', () async {
      final (container, repository) = setUpReview();
      repository.authorizeAnswer = () async => throw ApiRejected(code);

      await controllerOf(container).confirm('2580');
      await controllerOf(container).confirm('2580');

      expect(stateOf(container).finished, isTrue);
      expect(stateOf(container).error, message);
      expect(repository.callsOf('authorize'), hasLength(1));
    });
  }

  // MOB-07 (attack first): the server processed the Pix but the answer was
  // lost. The repetition must carry the same key, so the server answers with
  // what it recorded instead of treating it as another attempt.
  group('an answer that was lost', () {
    for (final (name, failure) in <(String, ApiFailure)>[
      ('no connection', const ApiUnreachable()),
      ('a server error', const ApiUnexpected()),
      (
        'a request still running',
        const ApiRejected(ApiErrorCode.requestInProgress),
      ),
    ]) {
      test('after $name, is asked again with the same key and PIN', () async {
        final (container, repository) = setUpReview();
        repository.authorizeAnswer = () async => throw failure;

        expect(await controllerOf(container).confirm('2580'), isNull);
        expect(stateOf(container).outcomeUnknown, isTrue);
        expect(stateOf(container).error, _unknownOutcome);

        repository.authorizeAnswer = () async =>
            pixTransfer(status: PixStatus.completed);
        final transfer = await controllerOf(container).retry();

        expect(transfer?.status, PixStatus.completed);
        expect(authorizations(repository), [
          ('key-1', '2580'),
          ('key-1', '2580'),
        ]);
        expect(stateOf(container).outcomeUnknown, isFalse);
      });
    }

    // Typing a PIN now would draw a new key for the same Pix.
    test('takes no new PIN until it is answered', () async {
      final (container, repository) = setUpReview();
      repository.authorizeAnswer = () async => throw const ApiUnreachable();

      await controllerOf(container).confirm('2580');
      await controllerOf(container).confirm('1357');

      expect(authorizations(repository), [('key-1', '2580')]);
    });
  });

  // MOB-02: the PIN lives only while its attempt has no answer.
  group('the PIN', () {
    test('is dropped once the server answers', () async {
      final (container, repository) = setUpReview();

      await controllerOf(container).confirm('2580');

      expect(await controllerOf(container).retry(), isNull);
      expect(repository.callsOf('authorize'), hasLength(1));
    });

    test('is dropped after a refusal', () async {
      final (container, repository) = setUpReview();
      repository.authorizeAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.pinIncorrect);

      await controllerOf(container).confirm('7413');

      expect(await controllerOf(container).retry(), isNull);
      expect(repository.callsOf('authorize'), hasLength(1));
    });

    test('is dropped with the screen', () async {
      final (container, repository) = setUpReview();
      repository.authorizeAnswer = () async => throw const ApiUnreachable();
      await controllerOf(container).confirm('2580');

      container.invalidate(reviewPixControllerProvider(_transferId));
      repository.authorizeAnswer = () async =>
          pixTransfer(status: PixStatus.completed);

      expect(await controllerOf(container).retry(), isNull);
      expect(repository.callsOf('authorize'), hasLength(1));
    });
  });

  // v1.1.0 plan, task 2: biometrics releases the kept PIN, which the server
  // checks like a typed one (ADR 0004, MOB-11).
  group('confirming with biometrics', () {
    test('authorizes with the kept PIN under a new key', () async {
      final (container, repository) = setUpReview(
        biometrics: FakeBiometricPinStore(pin: '2580'),
      );

      final transfer = await controllerOf(container).confirmWithBiometrics();

      expect(transfer?.status, PixStatus.completed);
      expect(authorizations(repository), [('key-1', '2580')]);
    });

    test('does nothing when the customer cancels', () async {
      final (container, repository) = setUpReview(
        biometrics: FakeBiometricPinStore(pin: '2580')
          ..nextRead = const BiometricCancelled(),
      );

      expect(await controllerOf(container).confirmWithBiometrics(), isNull);
      expect(repository.callsOf('authorize'), isEmpty);
      expect(stateOf(container).error, isNull);
    });

    test('asks for the PIN when the kept one is gone', () async {
      final biometrics = FakeBiometricPinStore(pin: '2580')
        ..nextRead = const BiometricPinLost();
      final (container, repository) = setUpReview(biometrics: biometrics);

      expect(await controllerOf(container).confirmWithBiometrics(), isNull);
      expect(repository.callsOf('authorize'), isEmpty);
      expect(
        stateOf(container).error,
        'A biometria foi desativada neste aparelho. Digite seu PIN.',
      );
    });

    test('forgets a kept PIN the server refuses', () async {
      final biometrics = FakeBiometricPinStore(pin: '1111');
      final (container, repository) = setUpReview(biometrics: biometrics);
      repository.authorizeAnswer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );

      await controllerOf(container).confirmWithBiometrics();

      expect(biometrics.pin, isNull);
      expect(stateOf(container).error, 'PIN incorreto. Restam 4 tentativas.');
    });

    test('forgets the kept PIN when the PIN gets locked, even typed', () async {
      final biometrics = FakeBiometricPinStore(pin: '2580');
      final (container, repository) = setUpReview(biometrics: biometrics);
      repository.authorizeAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.pinLocked);

      await controllerOf(container).confirm('7413');

      expect(stateOf(container).blocked, isTrue);
      expect(biometrics.pin, isNull);
    });
  });
}
