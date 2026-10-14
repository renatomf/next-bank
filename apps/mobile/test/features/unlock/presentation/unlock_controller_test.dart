import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/biometric_check.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/unlock/presentation/unlock_controller.dart';
import 'package:next_bank/features/unlock/presentation/unlock_providers.dart';

import '../../../support/fake_biometric_check.dart';
import '../../../support/fake_biometric_pin_store.dart';
import '../../../support/fake_greeting_name_store.dart';
import '../../../support/fake_token_store.dart';
import '../../../support/fake_unlock_repository.dart';

(ProviderContainer, FakeUnlockRepository) setUpUnlock({
  FakeBiometricPinStore? biometrics,
  FakeBiometricCheck? check,
}) {
  final repository = FakeUnlockRepository();
  final container = ProviderContainer(
    overrides: [
      biometricPinStoreProvider.overrideWithValue(
        biometrics ?? FakeBiometricPinStore(),
      ),
      biometricCheckProvider.overrideWithValue(check ?? FakeBiometricCheck()),
      greetingNameStoreProvider.overrideWithValue(FakeGreetingNameStore()),
      unlockRepositoryProvider.overrideWithValue(repository),
      tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
    ],
  );
  addTearDown(container.dispose);
  container
    ..listen(unlockControllerProvider, (_, _) {})
    ..listen(appLockProvider, (_, _) {});
  return (container, repository);
}

UnlockState stateOf(ProviderContainer container) =>
    container.read(unlockControllerProvider);

// Screen 5 states (domain-model.md 11): typing, verifying, PinIncorrect,
// PinLocked; a PIN that needs a reset offers to leave (week 6 plan, D6). The
// PIN is checked on the server (PIX-06) and never kept in the state (MOB-02).
void main() {
  group('UnlockController', () {
    test('unlocks the app when the server accepts the PIN', () async {
      final (container, repository) = setUpUnlock();

      await container.read(unlockControllerProvider.notifier).submit('2580');

      expect(repository.pins, ['2580']);
      expect(container.read(appLockProvider), isFalse);
    });

    test('says how many attempts are left after a wrong PIN', () async {
      final (container, repository) = setUpUnlock();
      repository.answer = () async => throw const ApiRejected(
        ApiErrorCode.pinIncorrect,
        remainingAttempts: 4,
      );

      await container.read(unlockControllerProvider.notifier).submit('7413');

      expect(stateOf(container).error, 'PIN incorreto. Restam 4 tentativas.');
      expect(stateOf(container).blocked, isFalse);
      expect(container.read(appLockProvider), isTrue);
    });

    for (final (code, message) in [
      (ApiErrorCode.pinLocked, 'PIN bloqueado por 30 minutos.'),
      (
        ApiErrorCode.pinResetRequired,
        'PIN bloqueado por segurança. Redefina o PIN com sua senha em '
            'Perfil > Segurança.',
      ),
    ]) {
      test('stops asking for the PIN when it is ${code.wire}', () async {
        final (container, repository) = setUpUnlock();
        repository.answer = () async => throw ApiRejected(code);

        await container.read(unlockControllerProvider.notifier).submit('7413');

        expect(stateOf(container).error, message);
        expect(stateOf(container).blocked, isTrue);
        expect(container.read(appLockProvider), isTrue);
      });
    }

    test('asks to try again when the API cannot be reached', () async {
      final (container, repository) = setUpUnlock();
      repository.answer = () async => throw const ApiUnreachable();

      await container.read(unlockControllerProvider.notifier).submit('2580');

      expect(stateOf(container).error, 'Sem conexão. Tente de novo.');
      expect(stateOf(container).verifying, isFalse);
      expect(stateOf(container).blocked, isFalse);
    });

    test('checks one PIN at a time on a double submit', () async {
      final (container, repository) = setUpUnlock();
      final gate = Completer<void>();
      repository.answer = () => gate.future;
      final controller = container.read(unlockControllerProvider.notifier);

      final first = controller.submit('2580');
      final second = controller.submit('2580');
      expect(stateOf(container).verifying, isTrue);
      gate.complete();
      await (first, second).wait;

      expect(repository.pins, hasLength(1));
    });
  });

  // v1.1.0 plan, task 2.1 (ADR 0013, MOB-13): the phone's prompt, face or
  // fingerprint, opens the app on the phone; the server never sees it.
  group('UnlockController with biometrics', () {
    test(
      'unlocks on the phone when the prompt recognizes the customer',
      () async {
        final biometrics = FakeBiometricPinStore(pin: '2580');
        final check = FakeBiometricCheck();
        final (container, repository) = setUpUnlock(
          biometrics: biometrics,
          check: check,
        );

        await container.read(unlockControllerProvider.notifier).useBiometrics();

        expect(check.checks, 1);
        expect(container.read(appLockProvider), isFalse);
        // Neither the server nor the kept PIN: the face cannot release it.
        expect(repository.pins, isEmpty);
        expect(biometrics.reads, 0);
      },
    );

    test('stays on the PIN, quietly, when the prompt fails', () async {
      final (container, repository) = setUpUnlock(
        biometrics: FakeBiometricPinStore(pin: '2580'),
        check: FakeBiometricCheck(passes: false),
      );

      await container.read(unlockControllerProvider.notifier).useBiometrics();

      expect(container.read(appLockProvider), isTrue);
      expect(stateOf(container).error, isNull);
      expect(repository.pins, isEmpty);
    });

    test('opens one prompt at a time on a double tap', () async {
      final gate = Completer<void>();
      final check = FakeBiometricCheck()..gate = gate.future;
      final (container, _) = setUpUnlock(
        biometrics: FakeBiometricPinStore(pin: '2580'),
        check: check,
      );
      final controller = container.read(unlockControllerProvider.notifier);

      final first = controller.useBiometrics();
      final second = controller.useBiometrics();
      gate.complete();
      await (first, second).wait;

      expect(check.checks, 1);
    });

    // Without a kept PIN biometrics were never turned on with the PIN, or
    // were turned off since: the face must not open the app (MOB-11).
    test('does nothing without a kept PIN', () async {
      final check = FakeBiometricCheck();
      final (container, _) = setUpUnlock(
        biometrics: FakeBiometricPinStore(),
        check: check,
      );

      await container.read(unlockControllerProvider.notifier).useBiometrics();

      expect(check.checks, 0);
      expect(container.read(appLockProvider), isTrue);
    });

    test('forgets the kept PIN when the PIN gets locked', () async {
      final biometrics = FakeBiometricPinStore(pin: '2580');
      final (container, repository) = setUpUnlock(biometrics: biometrics);
      repository.answer = () async =>
          throw const ApiRejected(ApiErrorCode.pinLocked);

      await container.read(unlockControllerProvider.notifier).submit('7413');

      expect(stateOf(container).blocked, isTrue);
      expect(biometrics.pin, isNull);
    });
  });

  group('biometricUnlockProvider', () {
    for (final (available, kept, offered) in [
      (true, '2580', true),
      (true, null, false),
      (false, '2580', false),
    ]) {
      test(
        'available $available, PIN kept ${kept != null}: offered $offered',
        () async {
          final (container, _) = setUpUnlock(
            biometrics: FakeBiometricPinStore(pin: kept, available: available),
          );

          expect(await container.read(biometricUnlockProvider.future), offered);
        },
      );
    }
  });
}
