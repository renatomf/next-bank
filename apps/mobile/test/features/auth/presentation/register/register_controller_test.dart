import 'dart:async';
import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/cpf.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/auth/presentation/register/register_controller.dart';

import '../../../../support/fake_auth_repository.dart';
import '../../../../support/fake_token_store.dart';

typedef Register = ({
  ProviderContainer container,
  FakeAuthRepository repository,
  FakeTokenStore store,
});

Future<Register> setUpRegister() async {
  final repository = FakeAuthRepository(tokens);
  final store = FakeTokenStore();
  final container = ProviderContainer(
    overrides: [
      tokenStoreProvider.overrideWithValue(store),
      authRepositoryProvider.overrideWithValue(repository),
      randomProvider.overrideWithValue(Random(42)),
    ],
  );
  addTearDown(container.dispose);
  await container.read(sessionProvider.future);
  container.listen(registerControllerProvider, (_, _) {});
  return (container: container, repository: repository, store: store);
}

extension on ProviderContainer {
  RegisterController get register => read(registerControllerProvider.notifier);
  RegisterState get registerState => read(registerControllerProvider);
}

Future<void> submitValid(ProviderContainer container) =>
    container.register.submit(
      name: '  Ana Souza ',
      email: ' ana@example.test ',
      password: 'a long passphrase',
    );

void main() {
  group('RegisterController', () {
    // DEMO-01: the visitor never types a CPF, so never a real one.
    test('starts with a fictitious valid CPF', () async {
      final (:container, repository: _, store: _) = await setUpRegister();

      expect(isValidCpf(container.registerState.cpf), isTrue);
    });

    test('draws another fictitious CPF on request', () async {
      final (:container, repository: _, store: _) = await setUpRegister();
      final first = container.registerState.cpf;

      container.register.drawAnotherCpf();

      expect(container.registerState.cpf, isNot(first));
      expect(isValidCpf(container.registerState.cpf), isTrue);
    });

    test('checks every field locally without calling the API', () async {
      final (:container, :repository, store: _) = await setUpRegister();

      await container.register.submit(
        name: ' A ',
        email: 'ana',
        password: 'too short',
      );

      final state = container.registerState;
      expect(state.nameError, 'Informe seu nome completo.');
      expect(state.emailError, 'Informe um e-mail válido.');
      expect(state.passwordError, 'Use de 10 a 128 caracteres.');
      expect(repository.registrations, isEmpty);
    });

    test('registers with the shown CPF and starts the session', () async {
      final (:container, :repository, :store) = await setUpRegister();
      final cpf = container.registerState.cpf;

      await submitValid(container);

      final sent = repository.registrations.single;
      expect(sent.name, 'Ana Souza');
      expect(sent.email, 'ana@example.test');
      expect(sent.cpf, cpf);
      expect(sent.password, 'a long passphrase');
      expect(store.stored, same(tokens));
      expect(container.read(sessionProvider).value, isA<SignedIn>());
    });

    test('sends one request on a double tap', () async {
      final (:container, :repository, store: _) = await setUpRegister();
      final gate = Completer<void>();
      repository.answer = () => gate.future;

      final first = submitValid(container);
      final second = submitValid(container);
      expect(container.registerState.sending, isTrue);
      gate.complete();
      await (first, second).wait;

      expect(repository.registrations, hasLength(1));
    });

    test('keeps the CPF while sending, so the request matches the screen', () {
      // The button is disabled while sending; drawing then is ignored.
      return setUpRegister().then((setup) async {
        final container = setup.container;
        final gate = Completer<void>();
        setup.repository.answer = () => gate.future;
        final cpf = container.registerState.cpf;

        final sending = submitValid(container);
        container.register.drawAnotherCpf();
        gate.complete();
        await sending;

        expect(setup.repository.registrations.single.cpf, cpf);
      });
    });

    test(
      'shows the vague refusal of an existing registration (AUTH-02)',
      () async {
        final (:container, :repository, store: _) = await setUpRegister();
        repository.answer = () async =>
            throw const ApiRejected(ApiErrorCode.alreadyRegistered);

        await submitValid(container);

        expect(
          container.registerState.error,
          'Não foi possível concluir o cadastro com esses dados.',
        );
        expect(container.registerState.sending, isFalse);
        expect(container.read(sessionProvider).value, isA<SignedOut>());
      },
    );
  });
}
