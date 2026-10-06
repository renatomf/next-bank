import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/auth/presentation/login_controller.dart';

import '../../../core/session/session_controller_test.dart';
import 'fake_auth_repository.dart';

typedef Login = ({
  ProviderContainer container,
  FakeAuthRepository repository,
  FakeTokenStore store,
});

Future<Login> setUpLogin() async {
  final repository = FakeAuthRepository(tokens);
  final store = FakeTokenStore();
  final container = ProviderContainer(
    overrides: [
      tokenStoreProvider.overrideWithValue(store),
      authRepositoryProvider.overrideWithValue(repository),
    ],
  );
  addTearDown(container.dispose);
  await container.read(sessionProvider.future);
  // Keeps the screen's controller alive, as the open screen does.
  container.listen(loginControllerProvider, (_, _) {});
  return (container: container, repository: repository, store: store);
}

extension on ProviderContainer {
  LoginController get login => read(loginControllerProvider.notifier);
  LoginState get loginState => read(loginControllerProvider);
}

void main() {
  group('LoginController', () {
    test('rejects an invalid e-mail without calling the API', () async {
      final (:container, :repository, store: _) = await setUpLogin();

      await container.login.submit(email: 'ana', password: 'any password');

      expect(container.loginState.emailError, 'Informe um e-mail válido.');
      expect(repository.logins, isEmpty);
    });

    test('asks for the password', () async {
      final (:container, :repository, store: _) = await setUpLogin();

      await container.login.submit(email: 'ana@example.test', password: '');

      expect(container.loginState.passwordError, 'Informe sua senha.');
      expect(repository.logins, isEmpty);
    });

    test('signs in with the trimmed e-mail and keeps the session', () async {
      final (:container, :repository, :store) = await setUpLogin();

      await container.login.submit(
        email: '  ana@example.test ',
        password: 'a long passphrase',
      );

      expect(repository.logins.single.email, 'ana@example.test');
      expect(repository.logins.single.password, 'a long passphrase');
      expect(store.stored, same(tokens));
      expect(container.read(sessionProvider).value, isA<SignedIn>());
    });

    test('sends one request on a double tap', () async {
      final (:container, :repository, store: _) = await setUpLogin();
      final gate = Completer<void>();
      repository.answer = () => gate.future;

      final first = container.login.submit(
        email: 'ana@example.test',
        password: 'a long passphrase',
      );
      final second = container.login.submit(
        email: 'ana@example.test',
        password: 'a long passphrase',
      );
      expect(container.loginState.sending, isTrue);
      gate.complete();
      await (first, second).wait;

      expect(repository.logins, hasLength(1));
    });

    test('shows the refusal of the API and lets the user try again', () async {
      final (:container, :repository, store: _) = await setUpLogin();
      repository.answer = () async =>
          throw const ApiRejected(ApiErrorCode.invalidCredentials);

      await container.login.submit(
        email: 'ana@example.test',
        password: 'a wrong passphrase',
      );

      expect(container.loginState.error, 'E-mail ou senha incorretos.');
      expect(container.loginState.sending, isFalse);
      expect(container.read(sessionProvider).value, isA<SignedOut>());
    });
  });
}
