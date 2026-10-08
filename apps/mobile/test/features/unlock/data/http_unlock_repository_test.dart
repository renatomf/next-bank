import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/unlock/data/http_unlock_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../../support/scripted_server.dart';

HttpUnlockRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server;
  return HttpUnlockRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

// POST /v1/me/pin/verify (F-16): the server checks the PIN, the app only asks.
void main() {
  group('HttpUnlockRepository', () {
    test('sends the PIN to be checked on the server', () async {
      final server = ScriptedServer({
        '/v1/me/pin/verify': (_) async => const JsonReply(204),
      });

      await repositoryFor(server).verifyPin('2580');

      expect(server.received.single.method, 'POST');
      final body = server.received.single.body;
      expect(body is String ? jsonDecode(body) : body, {'pin': '2580'});
    });

    test('reports a wrong PIN with the attempts left', () async {
      final server = ScriptedServer({
        '/v1/me/pin/verify': (_) async =>
            const ProblemReply(422, 'PinIncorrect', {'remainingAttempts': 2}),
      });

      await expectLater(
        repositoryFor(server).verifyPin('7413'),
        throwsA(
          isA<ApiRejected>()
              .having((f) => f.code, 'code', ApiErrorCode.pinIncorrect)
              .having((f) => f.remainingAttempts, 'remainingAttempts', 2),
        ),
      );
    });

    test('reports a locked PIN', () async {
      final server = ScriptedServer({
        '/v1/me/pin/verify': (_) async => const ProblemReply(423, 'PinLocked'),
      });

      await expectLater(
        repositoryFor(server).verifyPin('7413'),
        throwsA(
          isA<ApiRejected>().having(
            (f) => f.code,
            'code',
            ApiErrorCode.pinLocked,
          ),
        ),
      );
    });

    test('reports no answer as unreachable', () async {
      final server = ScriptedServer({
        '/v1/me/pin/verify': (_) async => const NetworkFailure(),
      });

      await expectLater(
        repositoryFor(server).verifyPin('2580'),
        throwsA(isA<ApiUnreachable>()),
      );
    });
  });
}
