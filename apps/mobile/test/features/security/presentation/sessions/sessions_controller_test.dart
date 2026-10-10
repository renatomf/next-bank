import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';
import 'package:next_bank/features/security/presentation/sessions/sessions_controller.dart';

import '../../../../support/fake_security_repository.dart';

Future<(ProviderContainer, FakeSecurityRepository)> open([
  FakeSecurityRepository? repository,
]) async {
  final fake = repository ?? FakeSecurityRepository();
  final container = ProviderContainer(
    overrides: [securityRepositoryProvider.overrideWithValue(fake)],
  );
  addTearDown(container.dispose);
  container.listen(sessionsControllerProvider, (_, _) {});
  await container
      .read(sessionsControllerProvider.future)
      .then<void>((_) {}, onError: (Object _) {});
  return (container, fake);
}

SessionsView viewOf(ProviderContainer container) =>
    container.read(sessionsControllerProvider).requireValue;

SessionsController controllerOf(ProviderContainer container) =>
    container.read(sessionsControllerProvider.notifier);

// Screen 14 (domain-model.md 11): the list of sessions, ending one after a
// confirmation; the current one is this device (week 7 plan, D3).
void main() {
  test('lists the active sessions', () async {
    final (container, _) = await open();

    expect(viewOf(container).sessions.map((s) => s.id), [
      'this-phone',
      'old-tablet',
    ]);
  });

  test('says when the sessions cannot be loaded', () async {
    final (container, _) = await open(
      FakeSecurityRepository()
        ..sessionsAnswer = () async => throw const ApiUnreachable(),
    );

    expect(
      container.read(sessionsControllerProvider).error,
      isA<ApiUnreachable>(),
    );
  });

  test('ends another session and reads the list again', () async {
    final (container, repository) = await open();
    repository.sessionsAnswer = () async => [
      session('this-phone', current: true),
    ];

    await controllerOf(container).revoke('old-tablet');

    expect(repository.revoked, ['old-tablet']);
    expect(viewOf(container).sessions.map((s) => s.id), ['this-phone']);
    expect(viewOf(container).revoking, isNull);
  });

  // D3: this device ends by signing out.
  test('never ends the current session', () async {
    final (container, repository) = await open();

    await controllerOf(container).revoke('this-phone');

    expect(repository.revoked, isEmpty);
  });

  test('ends one session at a time', () async {
    final (container, repository) = await open();
    final pending = Completer<void>();
    repository.answer = () => pending.future;

    final first = controllerOf(container).revoke('old-tablet');
    expect(viewOf(container).revoking, 'old-tablet');
    final second = controllerOf(container).revoke('old-tablet');
    pending.complete();
    await Future.wait([first, second]);

    expect(repository.revoked, ['old-tablet']);
  });

  // Ended meanwhile by the other device or a password change: the goal is
  // met, so the list is read again without an error.
  test('reads the list again when the session was already gone', () async {
    final (container, repository) = await open();
    repository
      ..answer = (() async => throw const ApiRejected(ApiErrorCode.notFound))
      ..sessionsAnswer = () async => [session('this-phone', current: true)];

    await controllerOf(container).revoke('old-tablet');

    expect(viewOf(container).error, isNull);
    expect(viewOf(container).sessions.map((s) => s.id), ['this-phone']);
  });

  test('keeps the list and says why when ending fails', () async {
    final (container, repository) = await open();
    repository.answer = () async => throw const ApiUnreachable();

    await controllerOf(container).revoke('old-tablet');

    expect(viewOf(container).error, 'Sem conexão. Tente de novo.');
    expect(viewOf(container).sessions, hasLength(2));
    expect(viewOf(container).revoking, isNull);
  });
}
