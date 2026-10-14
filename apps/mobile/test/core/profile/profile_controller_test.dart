import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/session/session_tokens.dart';

import '../../support/fake_biometric_pin_store.dart';
import '../../support/fake_greeting_name_store.dart';
import '../../support/fake_profile_repository.dart';
import '../../support/fake_token_store.dart';

(ProviderContainer, FakeProfileRepository) setUpProfile({
  FakeTokenStore? store,
  bool hasPin = true,
  FakeGreetingNameStore? greeting,
}) {
  final repository = FakeProfileRepository(hasPin: hasPin);
  final container = ProviderContainer(
    overrides: [
      biometricPinStoreProvider.overrideWithValue(FakeBiometricPinStore()),
      greetingNameStoreProvider.overrideWithValue(
        greeting ?? FakeGreetingNameStore(),
      ),
      tokenStoreProvider.overrideWithValue(store ?? FakeTokenStore(tokens)),
      profileRepositoryProvider.overrideWithValue(repository),
    ],
  );
  addTearDown(container.dispose);
  container.listen(profileProvider, (_, _) {});
  return (container, repository);
}

final SessionTokens refreshedTokens = SessionTokens(
  accessToken: 'access-token-2',
  accessTokenExpiresAt: DateTime.utc(2026, 10, 6, 12, 30),
  refreshToken: 'refresh-token-2',
);

// The signed-in customer's profile: the app greets them by name and resumes
// the registration at the PIN when it stopped before (week 4 plan, task 1).
void main() {
  group('profileProvider', () {
    // v1.1.0 plan, task 2: the unlock screen greets by the first name only,
    // kept on the device before the PIN is typed (MOB-12).
    test('keeps only the first name for the unlock greeting', () async {
      final greeting = FakeGreetingNameStore();
      final (container, _) = setUpProfile(greeting: greeting);

      await container.read(profileProvider.future);

      expect(greeting.name, 'Ana');
    });

    test('loads the profile of a signed-in session', () async {
      final (container, repository) = setUpProfile(hasPin: false);

      final profile = await container.read(profileProvider.future);

      expect(profile?.name, 'Ana Souza');
      expect(profile?.hasPin, isFalse);
      expect(repository.fetches, 1);
    });

    test('has no profile and asks nothing without a session', () async {
      final (container, repository) = setUpProfile(store: FakeTokenStore());

      expect(await container.read(profileProvider.future), isNull);
      expect(repository.fetches, 0);
    });

    test('does not reload when only the tokens are renewed', () async {
      final (container, repository) = setUpProfile();
      await container.read(profileProvider.future);

      await container.read(sessionProvider.notifier).signIn(refreshedTokens);
      await container.read(profileProvider.future);

      expect(repository.fetches, 1);
    });

    test(
      'loads again for the next sign-in, never keeping the last one',
      () async {
        final (container, repository) = setUpProfile();
        await container.read(profileProvider.future);
        final session = container.read(sessionProvider.notifier);

        await session.signOut();
        expect(await container.read(profileProvider.future), isNull);
        repository.name = 'Bruno Lima';
        await session.signIn(tokens);

        expect(
          (await container.read(profileProvider.future))?.name,
          'Bruno Lima',
        );
        expect(repository.fetches, 2);
      },
    );

    test('records the PIN as created without asking the API again', () async {
      final (container, repository) = setUpProfile(hasPin: false);
      await container.read(profileProvider.future);

      container.read(profileProvider.notifier).pinCreated();

      expect(container.read(profileProvider).value?.hasPin, isTrue);
      expect(container.read(profileProvider).value?.name, 'Ana Souza');
      expect(repository.fetches, 1);
    });
  });
}
