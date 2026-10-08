import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/unlock/presentation/unlock_controller.dart';
import 'package:next_bank/features/unlock/presentation/unlock_providers.dart';

import '../../../support/fake_token_store.dart';
import '../../../support/fake_unlock_repository.dart';

(ProviderContainer, FakeUnlockRepository) setUpUnlock() {
  final repository = FakeUnlockRepository();
  final container = ProviderContainer(
    overrides: [
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
}
