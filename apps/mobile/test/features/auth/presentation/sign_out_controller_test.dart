import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/auth/presentation/sign_out_controller.dart';

import '../../../support/fake_auth_repository.dart';
import '../../../support/fake_token_store.dart';

Future<(ProviderContainer, FakeAuthRepository, FakeTokenStore)>
setUpSignedIn() async {
  final repository = FakeAuthRepository(tokens);
  final store = FakeTokenStore(tokens);
  final container = ProviderContainer(
    overrides: [
      tokenStoreProvider.overrideWithValue(store),
      authRepositoryProvider.overrideWithValue(repository),
    ],
  );
  addTearDown(container.dispose);
  await container.read(sessionProvider.future);
  container.listen(signOutControllerProvider, (_, _) {});
  return (container, repository, store);
}

// AUTH-06 on the app side: leaving revokes the session on the server and
// always removes it from the device.
void main() {
  group('SignOutController', () {
    test('ends the session on the server and on the device', () async {
      final (container, repository, store) = await setUpSignedIn();

      await container.read(signOutControllerProvider.notifier).signOut();

      expect(repository.logouts, 1);
      expect(store.stored, isNull);
      final session = container.read(sessionProvider).value! as SignedOut;
      expect(session.reason, isNull);
    });

    test('clears the device even when the API cannot be reached', () async {
      final (container, repository, store) = await setUpSignedIn();
      repository.answer = () async => throw const ApiUnreachable();

      await container.read(signOutControllerProvider.notifier).signOut();

      expect(store.stored, isNull);
      expect(container.read(sessionProvider).value, isA<SignedOut>());
    });

    test('sends one request on a double tap', () async {
      final (container, repository, _) = await setUpSignedIn();
      final gate = Completer<void>();
      repository.answer = () => gate.future;
      final controller = container.read(signOutControllerProvider.notifier);

      final first = controller.signOut();
      final second = controller.signOut();
      expect(container.read(signOutControllerProvider), isTrue);
      gate.complete();
      await (first, second).wait;

      expect(repository.logouts, 1);
    });
  });
}
