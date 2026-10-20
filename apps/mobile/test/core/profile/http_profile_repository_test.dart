import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/profile/http_profile_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../support/scripted_server.dart';

HttpProfileRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server;
  return HttpProfileRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

void main() {
  group('HttpProfileRepository', () {
    test('reads the name, the masked CPF and whether the PIN exists', () async {
      final server = ScriptedServer({
        '/v1/me': (_) async => const JsonReply(200, {
          'name': 'Maria Teste',
          'cpfMasked': '***.456.789-**',
          'hasPin': false,
        }),
      });

      final profile = await repositoryFor(server).fetch();

      expect(server.received.single.method, 'GET');
      expect(profile.name, 'Maria Teste');
      expect(profile.cpfMasked, '***.456.789-**');
      expect(profile.hasPin, isFalse);
    });

    test('reports no connection as ApiUnreachable', () async {
      final server = ScriptedServer({
        '/v1/me': (_) async => const NetworkFailure(),
      });

      await expectLater(
        repositoryFor(server).fetch(),
        throwsA(isA<ApiUnreachable>()),
      );
    });

    // MASVS (code): data from the API is checked before use.
    test('refuses an answer without the PIN status', () async {
      final server = ScriptedServer({
        '/v1/me': (_) async => const JsonReply(200, {
          'name': 'Maria Teste',
          'cpfMasked': '***.456.789-**',
        }),
      });

      await expectLater(
        repositoryFor(server).fetch(),
        throwsA(isA<ApiUnexpected>()),
      );
    });
  });
}
