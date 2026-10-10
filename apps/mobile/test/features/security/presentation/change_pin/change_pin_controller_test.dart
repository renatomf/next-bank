import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/security/presentation/change_pin/change_pin_controller.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';

import '../../../../support/fake_security_repository.dart';

(ProviderContainer, FakeSecurityRepository) setUpChange() {
  final repository = FakeSecurityRepository();
  final container = ProviderContainer(
    overrides: [securityRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  container.listen(changePinControllerProvider, (_, _) {});
  return (container, repository);
}

ChangePinController controllerOf(ProviderContainer container) =>
    container.read(changePinControllerProvider.notifier);

ChangePinState stateOf(ProviderContainer container) =>
    container.read(changePinControllerProvider);

Future<void> submit(
  ProviderContainer container, {
  String password = 'violet staple orbit 42',
  String newPin = '1597',
  String confirmPin = '1597',
}) =>
    controllerOf(container)
        .submit(password: password, newPin: newPin, confirmPin: confirmPin);

// Changing the PIN with the password (screen 14; domain-model.md 3.1), also
// how a locked PIN works again (week 7 plan, D5). The PIN and the password
// are never kept in the state (MOB-02).
void main() {
  test('changes the PIN with the password', () async {
    final (container, repository) = setUpChange();

    await submit(container);

    expect(repository.pinChanges, [
      (password: 'violet staple orbit 42', newPin: '1597'),
    ]);
    expect(stateOf(container).done, isTrue);
  });

  group('checked on the device, without calling the API', () {
    for (final (name, password, newPin, confirmPin, field, message) in [
      ('no password', '', '1597', '1597', 'password', 'Informe sua senha.'),
      (
        'a trivial PIN',
        'violet staple orbit 42',
        '1234',
        '1234',
        'pin',
        'Use 4 dígitos que não sejam repetidos nem em sequência.',
      ),
      (
        'PINs that differ',
        'violet staple orbit 42',
        '1597',
        '1598',
        'confirm',
        'Os PINs não conferem. Digite de novo.',
      ),
    ]) {
      test(name, () async {
        final (container, repository) = setUpChange();

        await submit(
          container,
          password: password,
          newPin: newPin,
          confirmPin: confirmPin,
        );

        final state = stateOf(container);
        final shown = switch (field) {
          'password' => state.passwordError,
          'pin' => state.pinError,
          _ => state.confirmError,
        };
        expect(shown, message);
        expect(repository.pinChanges, isEmpty);
      });
    }
  });

  test('shows a wrong password beside the password', () async {
    final (container, repository) = setUpChange();
    repository.answer = () async =>
        throw const ApiRejected(ApiErrorCode.passwordIncorrect);

    await submit(container);

    expect(stateOf(container).passwordError, 'Senha incorreta.');
    expect(stateOf(container).done, isFalse);
  });

  // AUTH-01: the login's block holds here.
  test('says when there were too many attempts', () async {
    final (container, repository) = setUpChange();
    repository.answer = () async =>
        throw const ApiRejected(ApiErrorCode.tooManyAttempts);

    await submit(container);

    expect(
      stateOf(container).error,
      'Muitas tentativas. Tente de novo em alguns minutos.',
    );
  });

  test('sends once on a double tap', () async {
    final (container, repository) = setUpChange();
    final pending = Completer<void>();
    repository.answer = () => pending.future;

    final first = submit(container);
    expect(stateOf(container).submitting, isTrue);
    final second = submit(container);
    pending.complete();
    await Future.wait([first, second]);

    expect(repository.pinChanges, hasLength(1));
    expect(stateOf(container).submitting, isFalse);
  });
}
