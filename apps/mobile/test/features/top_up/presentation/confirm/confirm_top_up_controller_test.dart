import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/presentation/confirm/confirm_top_up_controller.dart';
import 'package:next_bank/features/top_up/presentation/top_up_providers.dart';

import '../../../../support/fake_biometric_pin_store.dart';
import '../../../../support/fake_pix_repository.dart' show sequentialKeys;
import '../../../../support/fake_top_up_repository.dart';

const TopUpDraft _draft = (
  operator: (id: 'pulso-celular', name: 'Pulso Celular', initials: 'PC'),
  phoneDigits: '11900000001',
  phoneMasked: '(11) *****-0001',
  amountCents: 3000,
);

(ProviderContainer, FakeTopUpRepository) setUpConfirm({
  FakeBiometricPinStore? biometrics,
}) {
  final repository = FakeTopUpRepository();
  final container = ProviderContainer(
    overrides: [
      biometricPinStoreProvider.overrideWithValue(
        biometrics ?? FakeBiometricPinStore(),
      ),
      topUpRepositoryProvider.overrideWithValue(repository),
      idempotencyKeysProvider.overrideWithValue(sequentialKeys()),
    ],
  );
  addTearDown(container.dispose);
  container.listen(confirmTopUpControllerProvider(_draft), (_, _) {});
  return (container, repository);
}

ConfirmTopUpController controllerOf(ProviderContainer container) =>
    container.read(confirmTopUpControllerProvider(_draft).notifier);

ConfirmTopUpState stateOf(ProviderContainer container) =>
    container.read(confirmTopUpControllerProvider(_draft));

List<(String?, String?)> attempts(FakeTopUpRepository repository) => [
  for (final call in repository.callsOf('create'))
    (call.idempotencyKey, call.pin),
];

const _unknownOutcome =
    'Não conseguimos confirmar a recarga. Tente de novo: ela não será feita '
    'duas vezes.';

// The confirmation of a top-up (v1.1.0 plan, task 5b), as the Pix review:
// the PIN checked on the server (PIX-06), one key per attempt and the same
// key for a lost answer (MOB-07), never the PIN in the state (MOB-02).
void main() {
  test('tops up with the draft, the PIN and the key of the attempt', () async {
    final (container, repository) = setUpConfirm();

    final done = await controllerOf(container).confirm('2580');

    final call = repository.callsOf('create').single;
    expect(call.operatorId, 'pulso-celular');
    expect(call.phoneDigits, '11900000001');
    expect(call.amountCents, 3000);
    expect(call.pin, '2580');
    expect(call.idempotencyKey, 'key-1');
    expect(done?.id, 'top-up-1');
  });

  // TOP-02 on the app side: a double tap is one top-up.
  test('confirms once while a top-up runs', () async {
    final (container, repository) = setUpConfirm();
    final answer = Completer<TopUp>();
    repository.createAnswer = () => answer.future;

    final first = controllerOf(container).confirm('2580');
    expect(stateOf(container).verifying, isTrue);
    final second = controllerOf(container).confirm('2580');
    answer.complete(topUpDone());
    await Future.wait([first, second]);

    expect(repository.callsOf('create'), hasLength(1));
    expect(stateOf(container).verifying, isFalse);
  });

  group('a wrong or locked PIN', () {
    test('says how many attempts are left', () async {
      final (container, repository) = setUpConfirm();
      repository.createAnswer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );

      expect(await controllerOf(container).confirm('7413'), isNull);

      expect(stateOf(container).error, 'PIN incorreto. Restam 4 tentativas.');
      expect(stateOf(container).blocked, isFalse);
    });

    test('a PIN typed again goes with a new key', () async {
      final (container, repository) = setUpConfirm();
      repository.createAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.pinIncorrect);

      await controllerOf(container).confirm('7413');
      repository.createAnswer = () async => topUpDone();
      await controllerOf(container).confirm('2580');

      expect(attempts(repository), [('key-1', '7413'), ('key-2', '2580')]);
    });

    for (final code in [
      ApiErrorCode.pinLocked,
      ApiErrorCode.pinResetRequired,
    ]) {
      test('${code.wire} leaves no PIN to type', () async {
        final (container, repository) = setUpConfirm();
        repository.createAnswer = () async => throw ApiRejected(code);

        await controllerOf(container).confirm('7413');
        await controllerOf(container).confirm('2580');

        expect(stateOf(container).blocked, isTrue);
        expect(repository.callsOf('create'), hasLength(1));
      });
    }
  });

  // D6: the server knows the day's total; the app only says it.
  test("says what is left of the day's limit", () async {
    final (container, repository) = setUpConfirm();
    repository.createAnswer = () async => throw const ApiRejected(
      ApiErrorCode.topUpLimitExceeded,
      limitCents: 20000,
      remainingCents: 1500,
    );

    await controllerOf(container).confirm('2580');

    expect(
      stateOf(container).error,
      r'Você pode recarregar até R$ 200,00 por dia. Restam R$ 15,00 hoje.',
    );
  });

  // MOB-07 (attack first): the server took the top-up but the answer was
  // lost; the repetition carries the same key, so it is never done twice.
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
        final (container, repository) = setUpConfirm();
        repository.createAnswer = () async => throw failure;

        expect(await controllerOf(container).confirm('2580'), isNull);
        expect(stateOf(container).outcomeUnknown, isTrue);
        expect(stateOf(container).error, _unknownOutcome);

        repository.createAnswer = () async => topUpDone();
        final done = await controllerOf(container).retry();

        expect(done?.id, 'top-up-1');
        expect(attempts(repository), [('key-1', '2580'), ('key-1', '2580')]);
        expect(stateOf(container).outcomeUnknown, isFalse);
      });
    }

    test('takes no new PIN until it is answered', () async {
      final (container, repository) = setUpConfirm();
      repository.createAnswer = () async => throw const ApiUnreachable();

      await controllerOf(container).confirm('2580');
      await controllerOf(container).confirm('1357');

      expect(attempts(repository), [('key-1', '2580')]);
    });
  });

  // MOB-02: the PIN lives only while its attempt has no answer.
  group('the PIN', () {
    test('is dropped once the server answers', () async {
      final (container, repository) = setUpConfirm();

      await controllerOf(container).confirm('2580');

      expect(await controllerOf(container).retry(), isNull);
      expect(repository.callsOf('create'), hasLength(1));
    });

    test('is dropped with the screen', () async {
      final (container, repository) = setUpConfirm();
      repository.createAnswer = () async => throw const ApiUnreachable();
      await controllerOf(container).confirm('2580');

      container.invalidate(confirmTopUpControllerProvider(_draft));
      repository.createAnswer = () async => topUpDone();

      expect(await controllerOf(container).retry(), isNull);
      expect(repository.callsOf('create'), hasLength(1));
    });
  });

  // D11: biometrics releases the kept PIN, which the server checks like a
  // typed one (ADR 0004, MOB-11).
  group('confirming with biometrics', () {
    test('tops up with the kept PIN under a new key', () async {
      final (container, repository) = setUpConfirm(
        biometrics: FakeBiometricPinStore(pin: '2580'),
      );

      final done = await controllerOf(container).confirmWithBiometrics();

      expect(done?.id, 'top-up-1');
      expect(attempts(repository), [('key-1', '2580')]);
    });

    test('does nothing when the customer cancels', () async {
      final (container, repository) = setUpConfirm(
        biometrics: FakeBiometricPinStore(pin: '2580')
          ..nextRead = const BiometricCancelled(),
      );

      expect(await controllerOf(container).confirmWithBiometrics(), isNull);
      expect(repository.callsOf('create'), isEmpty);
      expect(stateOf(container).error, isNull);
    });

    test('asks for the PIN when the kept one is gone', () async {
      final (container, repository) = setUpConfirm(
        biometrics: FakeBiometricPinStore(pin: '2580')
          ..nextRead = const BiometricPinLost(),
      );

      expect(await controllerOf(container).confirmWithBiometrics(), isNull);
      expect(repository.callsOf('create'), isEmpty);
      expect(
        stateOf(container).error,
        'A biometria foi desativada neste aparelho. Digite seu PIN.',
      );
    });

    test('forgets a kept PIN the server refuses', () async {
      final biometrics = FakeBiometricPinStore(pin: '1111');
      final (container, repository) = setUpConfirm(biometrics: biometrics);
      repository.createAnswer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );

      await controllerOf(container).confirmWithBiometrics();

      expect(biometrics.pin, isNull);
    });

    test('forgets the kept PIN when the PIN gets locked, even typed', () async {
      final biometrics = FakeBiometricPinStore(pin: '2580');
      final (container, repository) = setUpConfirm(biometrics: biometrics);
      repository.createAnswer = () async =>
          throw const ApiRejected(ApiErrorCode.pinLocked);

      await controllerOf(container).confirm('7413');

      expect(stateOf(container).blocked, isTrue);
      expect(biometrics.pin, isNull);
    });
  });
}
