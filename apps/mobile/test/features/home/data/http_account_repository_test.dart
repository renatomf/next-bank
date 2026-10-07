import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/home/data/http_account_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../../support/scripted_server.dart';

HttpAccountRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server;
  return HttpAccountRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

Map<String, Object?> account({Object? amount = 1000000, Object? currency}) => {
  'branch': '0001',
  'number': '100000-4',
  'status': 'ACTIVE',
  'availableBalance': {'amount': amount, 'currency': currency ?? 'BRL'},
};

// The customer's account from GET /v1/me/account. The app never computes a
// balance (roadmap 6.7): it shows what the server sends, after checking it
// (MASVS, code).
void main() {
  group('HttpAccountRepository', () {
    test('reads the account and the balance in integer cents', () async {
      final server = ScriptedServer({
        '/v1/me/account': (_) async => JsonReply(200, account()),
      });

      final summary = await repositoryFor(server).fetch();

      expect(server.received.single.method, 'GET');
      expect(summary.branch, '0001');
      expect(summary.number, '100000-4');
      expect(summary.availableBalanceCents, 1000000);
    });

    test('refuses a fractional amount: money is never a double', () async {
      final server = ScriptedServer({
        '/v1/me/account': (_) async => JsonReply(200, account(amount: 10.5)),
      });

      await expectLater(
        repositoryFor(server).fetch(),
        throwsA(isA<ApiUnexpected>()),
      );
    });

    test('refuses another currency', () async {
      final server = ScriptedServer({
        '/v1/me/account': (_) async => JsonReply(200, account(currency: 'USD')),
      });

      await expectLater(
        repositoryFor(server).fetch(),
        throwsA(isA<ApiUnexpected>()),
      );
    });

    test('refuses a negative balance, which the server never sends', () async {
      final server = ScriptedServer({
        '/v1/me/account': (_) async => JsonReply(200, account(amount: -1)),
      });

      await expectLater(
        repositoryFor(server).fetch(),
        throwsA(isA<ApiUnexpected>()),
      );
    });

    test('reports an account the server does not have as NotFound', () async {
      final server = ScriptedServer({
        '/v1/me/account': (_) async => const ProblemReply(404, 'NotFound'),
      });

      await expectLater(
        repositoryFor(server).fetch(),
        throwsA(
          isA<ApiRejected>().having(
            (r) => r.code,
            'code',
            ApiErrorCode.notFound,
          ),
        ),
      );
    });

    test('reports no connection as ApiUnreachable', () async {
      final server = ScriptedServer({
        '/v1/me/account': (_) async => const NetworkFailure(),
      });

      await expectLater(
        repositoryFor(server).fetch(),
        throwsA(isA<ApiUnreachable>()),
      );
    });
  });
}
