import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/security/presentation/change_password/change_password_controller.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';

import '../../../../support/fake_security_repository.dart';

(ProviderContainer, FakeSecurityRepository) setUpChange() {
  final repository = FakeSecurityRepository();
  final container = ProviderContainer(
    overrides: [securityRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  container.listen(changePasswordControllerProvider, (_, _) {});
  return (container, repository);
}

ChangePasswordController controllerOf(ProviderContainer container) =>
    container.read(changePasswordControllerProvider.notifier);

ChangePasswordState stateOf(ProviderContainer container) =>
    container.read(changePasswordControllerProvider);

Future<void> submit(
  ProviderContainer container, {
  String currentPassword = 'violet staple orbit 42',
  String newPassword = 'amber kettle ridge 77',
  String confirmPassword = 'amber kettle ridge 77',
}) => controllerOf(container).submit(
  currentPassword: currentPassword,
  newPassword: newPassword,
  confirmPassword: confirmPassword,
);

// Changing the password with the current one (screen 14; ASVS; week 7 plan,
// D4): every other session ends (AUTH-06). No password stays in the state
// (MOB-02).
void main() {
  test('changes the password with the current one', () async {
    final (container, repository) = setUpChange();

    await submit(container);

    expect(repository.passwordChanges, [
      (
        currentPassword: 'violet staple orbit 42',
        newPassword: 'amber kettle ridge 77',
      ),
    ]);
    expect(stateOf(container).done, isTrue);
  });

  group('checked on the device, without calling the API', () {
    for (final (name, current, newPassword, confirm, field, message) in [
      (
        'no current password',
        '',
        'amber kettle ridge 77',
        'amber kettle ridge 77',
        'current',
        'Informe sua senha.',
      ),
      (
        'a short new password',
        'violet staple orbit 42',
        'short',
        'short',
        'new',
        'Use de 10 a 128 caracteres.',
      ),
      (
        'passwords that differ',
        'violet staple orbit 42',
        'amber kettle ridge 77',
        'amber kettle ridge 78',
        'confirm',
        'As senhas não conferem. Digite de novo.',
      ),
    ]) {
      test(name, () async {
        final (container, repository) = setUpChange();

        await submit(
          container,
          currentPassword: current,
          newPassword: newPassword,
          confirmPassword: confirm,
        );

        final state = stateOf(container);
        final shown = switch (field) {
          'current' => state.currentPasswordError,
          'new' => state.newPasswordError,
          _ => state.confirmError,
        };
        expect(shown, message);
        expect(repository.passwordChanges, isEmpty);
      });
    }
  });

  test('shows a wrong current password beside it', () async {
    final (container, repository) = setUpChange();
    repository.answer = () async =>
        throw const ApiRejected(ApiErrorCode.passwordIncorrect);

    await submit(container);

    expect(stateOf(container).currentPasswordError, 'Senha incorreta.');
  });

  // AUTH-07: a common password the device cannot know is refused by the API.
  test('shows a weak new password beside it', () async {
    final (container, repository) = setUpChange();
    repository.answer = () async =>
        throw const ApiRejected(ApiErrorCode.weakPassword);

    await submit(container);

    expect(
      stateOf(container).newPasswordError,
      'Use pelo menos 10 caracteres e evite senhas comuns.',
    );
  });

  test('says when there is no connection', () async {
    final (container, repository) = setUpChange();
    repository.answer = () async => throw const ApiUnreachable();

    await submit(container);

    expect(stateOf(container).error, 'Sem conexão. Tente de novo.');
  });

  test('sends once on a double tap', () async {
    final (container, repository) = setUpChange();
    final pending = Completer<void>();
    repository.answer = () => pending.future;

    final first = submit(container);
    final second = submit(container);
    pending.complete();
    await Future.wait([first, second]);

    expect(repository.passwordChanges, hasLength(1));
  });
}
