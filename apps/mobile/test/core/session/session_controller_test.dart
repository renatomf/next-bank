import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/core/session/session_end_reason.dart';

import '../../support/fake_token_store.dart';

ProviderContainer containerWith(FakeTokenStore store) {
  final container = ProviderContainer(
    overrides: [tokenStoreProvider.overrideWithValue(store)],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('sessionProvider', () {
    test('restores a signed-in session from the device on start', () async {
      final container = containerWith(FakeTokenStore(tokens));

      final session = await container.read(sessionProvider.future);

      expect(session, isA<SignedIn>());
      expect((session as SignedIn).tokens.refreshToken, 'refresh-token-value');
    });

    test('starts signed out when the device holds no session', () async {
      final container = containerWith(FakeTokenStore());

      expect(await container.read(sessionProvider.future), isA<SignedOut>());
    });

    test('keeps the tokens on the device when signing in', () async {
      final store = FakeTokenStore();
      final container = containerWith(store);
      await container.read(sessionProvider.future);

      await container.read(sessionProvider.notifier).signIn(tokens);

      expect(store.stored, same(tokens));
      expect(container.read(sessionProvider).value, isA<SignedIn>());
    });

    test(
      'removes the tokens from the device when signing out (AUTH-06)',
      () async {
        final store = FakeTokenStore(tokens);
        final container = containerWith(store);
        await container.read(sessionProvider.future);

        await container.read(sessionProvider.notifier).signOut();

        expect(store.stored, isNull);
        expect(store.clears, 1);
        expect(container.read(sessionProvider).value, isA<SignedOut>());
      },
    );

    test('a logout ends the session without a reason to report', () async {
      final container = containerWith(FakeTokenStore(tokens));
      await container.read(sessionProvider.future);

      await container.read(sessionProvider.notifier).signOut();

      final session = container.read(sessionProvider).value! as SignedOut;
      expect(session.reason, isNull);
    });

    test('remembers why the server ended the session', () async {
      final store = FakeTokenStore(tokens);
      final container = containerWith(store);
      await container.read(sessionProvider.future);

      await container
          .read(sessionProvider.notifier)
          .signOut(SessionEndReason.revoked);

      final session = container.read(sessionProvider).value! as SignedOut;
      expect(session.reason, SessionEndReason.revoked);
      expect(store.stored, isNull);
    });
  });
}
