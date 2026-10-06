import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/auth/data/http_auth_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../../support/scripted_server.dart';

HttpAuthRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server;
  return HttpAuthRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

Map<String, Object?> bodyOf(ReceivedRequest request) {
  final body = request.body;
  return (body is String ? jsonDecode(body) : body)! as Map<String, Object?>;
}

void main() {
  group('HttpAuthRepository', () {
    test(
      'registers with the contract fields and returns the session',
      () async {
        final server = ScriptedServer({
          '/v1/auth/register': (_) async =>
              JsonReply(201, authTokens('access-1', 'refresh-1')),
        });

        final tokens = await repositoryFor(server).register(
          name: 'Maria Teste',
          email: 'maria@example.test',
          cpf: '12345678909',
          password: 'violet staple orbit 42',
          deviceLabel: 'Pixel 8',
        );

        expect(bodyOf(server.received.single), {
          'name': 'Maria Teste',
          'email': 'maria@example.test',
          'cpf': '12345678909',
          'password': 'violet staple orbit 42',
          'deviceLabel': 'Pixel 8',
        });
        expect(tokens.accessToken, 'access-1');
        expect(tokens.refreshToken, 'refresh-1');
        expect(tokens.accessTokenExpiresAt, DateTime.utc(2026, 10, 6, 12, 15));
      },
    );

    test('logs in and returns the session', () async {
      final server = ScriptedServer({
        '/v1/auth/login': (_) async =>
            JsonReply(200, authTokens('access-2', 'refresh-2')),
      });

      final tokens = await repositoryFor(server).login(
        email: 'maria@example.test',
        password: 'violet staple orbit 42',
        deviceLabel: 'Pixel 8',
      );

      expect(bodyOf(server.received.single), {
        'email': 'maria@example.test',
        'password': 'violet staple orbit 42',
        'deviceLabel': 'Pixel 8',
      });
      expect(tokens.refreshToken, 'refresh-2');
    });

    test('creates the PIN', () async {
      final server = ScriptedServer({
        '/v1/me/pin': (_) async => const JsonReply(204),
      });

      await repositoryFor(server).createPin('2580');

      expect(bodyOf(server.received.single), {'pin': '2580'});
    });

    test('ends the session on the server', () async {
      final server = ScriptedServer({
        '/v1/auth/logout': (_) async => const JsonReply(204),
      });

      await repositoryFor(server).logout();

      expect(server.received.single.method, 'POST');
    });

    test('reports a refusal with its catalog code', () async {
      final server = ScriptedServer({
        '/v1/auth/login': (_) async =>
            const ProblemReply(401, 'InvalidCredentials'),
      });

      await expectLater(
        repositoryFor(server).login(
          email: 'maria@example.test',
          password: 'wrong password here',
          deviceLabel: null,
        ),
        throwsA(
          isA<ApiRejected>().having(
            (f) => f.code,
            'code',
            ApiErrorCode.invalidCredentials,
          ),
        ),
      );
    });

    test('reports a missing connection as unreachable', () async {
      final server = ScriptedServer({
        '/v1/me/pin': (_) async => const NetworkFailure(),
      });

      await expectLater(
        repositoryFor(server).createPin('2580'),
        throwsA(isA<ApiUnreachable>()),
      );
    });
  });
}
