import 'dart:async';

import 'package:next_bank/core/session/session_tokens.dart';
import 'package:next_bank/features/auth/domain/auth_repository.dart';

/// Fake [AuthRepository]: records the calls and answers with [answer], which
/// a test can hold open (a pending completer) or make fail.
class FakeAuthRepository implements AuthRepository {
  new(this.tokens);

  /// Tokens returned by a successful login or registration.
  final SessionTokens tokens;

  /// What the next call does; by default it succeeds at once.
  Future<void> Function() answer = () async {};

  final List<({String email, String password})> logins = [];
  int logouts = 0;

  @override
  Future<SessionTokens> login({
    required String email,
    required String password,
    required String? deviceLabel,
  }) async {
    logins.add((email: email, password: password));
    await answer();
    return tokens;
  }

  @override
  Future<void> logout() async {
    logouts++;
    await answer();
  }

  @override
  Future<SessionTokens> register({
    required String name,
    required String email,
    required String cpf,
    required String password,
    required String? deviceLabel,
  }) => throw UnimplementedError();

  @override
  Future<void> createPin(String pin) => throw UnimplementedError();
}
