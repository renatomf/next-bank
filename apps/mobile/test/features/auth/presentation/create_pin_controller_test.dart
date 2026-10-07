import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/auth/presentation/create_pin_controller.dart';

import '../../../support/fake_auth_repository.dart';
import '../../../support/fake_profile_repository.dart';
import '../../../support/fake_token_store.dart';

/// A signed-in account that still needs its PIN.
(ProviderContainer, FakeAuthRepository) setUpCreatePin() {
  final repository = FakeAuthRepository(tokens);
  final container = ProviderContainer(
    overrides: [
      authRepositoryProvider.overrideWithValue(repository),
      tokenStoreProvider.overrideWithValue(FakeTokenStore(tokens)),
      profileRepositoryProvider.overrideWithValue(
        FakeProfileRepository(hasPin: false),
      ),
    ],
  );
  addTearDown(container.dispose);
  container
    ..listen(createPinControllerProvider, (_, _) {})
    ..listen(profileProvider, (_, _) {});
  return (container, repository);
}

bool? profileHasPin(ProviderContainer container) =>
    container.read(profileProvider).value?.hasPin;

const String trivialPinMessage =
    'Use 4 dígitos que não sejam repetidos nem em sequência.';

// Screen 4 states (domain-model.md, section 11): type, confirm, PINs that
// differ, trivial PIN. The PIN itself never enters the state (MOB-02).
void main() {
  group('CreatePinController', () {
    test('accepts a non-trivial PIN as the first step', () {
      final (container, _) = setUpCreatePin();
      final controller = container.read(createPinControllerProvider.notifier);

      expect(controller.check('2580'), isTrue);
      expect(container.read(createPinControllerProvider).error, isNull);
    });

    test('refuses a trivial PIN before asking to confirm it', () {
      final (container, _) = setUpCreatePin();
      final controller = container.read(createPinControllerProvider.notifier);

      expect(controller.check('1234'), isFalse);
      expect(
        container.read(createPinControllerProvider).error,
        trivialPinMessage,
      );
    });

    test(
      'refuses a confirmation that differs, without calling the API',
      () async {
        final (container, repository) = setUpCreatePin();

        await container
            .read(createPinControllerProvider.notifier)
            .submit(pin: '2580', confirmation: '2581');

        expect(
          container.read(createPinControllerProvider).error,
          'Os PINs não conferem. Digite de novo.',
        );
        expect(repository.pins, isEmpty);
      },
    );

    test('creates the PIN and records it on the profile', () async {
      final (container, repository) = setUpCreatePin();
      await container.read(profileProvider.future);

      await container
          .read(createPinControllerProvider.notifier)
          .submit(pin: '2580', confirmation: '2580');

      expect(repository.pins, ['2580']);
      expect(container.read(createPinControllerProvider).created, isTrue);
      // Without this, the navigation would send the account back to the PIN.
      expect(profileHasPin(container), isTrue);
    });

    test('moves on when the account already has a PIN', () async {
      final (container, repository) = setUpCreatePin();
      await container.read(profileProvider.future);
      repository.answer = () async =>
          throw const ApiRejected(ApiErrorCode.pinAlreadyCreated);

      await container
          .read(createPinControllerProvider.notifier)
          .submit(pin: '2580', confirmation: '2580');

      expect(container.read(createPinControllerProvider).created, isTrue);
      expect(profileHasPin(container), isTrue);
    });

    test('shows why the API could not create it', () async {
      final (container, repository) = setUpCreatePin();
      await container.read(profileProvider.future);
      repository.answer = () async => throw const ApiUnreachable();

      await container
          .read(createPinControllerProvider.notifier)
          .submit(pin: '2580', confirmation: '2580');

      final state = container.read(createPinControllerProvider);
      expect(state.error, 'Sem conexão. Tente de novo.');
      expect(state.created, isFalse);
      expect(state.sending, isFalse);
      expect(profileHasPin(container), isFalse);
    });

    test('sends one request on a double tap', () async {
      final (container, repository) = setUpCreatePin();
      final gate = Completer<void>();
      repository.answer = () => gate.future;
      final controller = container.read(createPinControllerProvider.notifier);

      final first = controller.submit(pin: '2580', confirmation: '2580');
      final second = controller.submit(pin: '2580', confirmation: '2580');
      gate.complete();
      await (first, second).wait;

      expect(repository.pins, hasLength(1));
    });
  });
}
