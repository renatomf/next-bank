import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/home/data/http_api_status_repository.dart';
import 'package:next_bank/features/home/domain/api_status.dart';
import 'package:nextbank_api/nextbank_api.dart';

import 'fake_adapter.dart';

HttpApiStatusRepository repositoryWith(FakeAdapter adapter) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.test'))
    ..httpClientAdapter = adapter;
  return HttpApiStatusRepository(NextbankApi(dio: dio).getDefaultApi());
}

void main() {
  group('HttpApiStatusRepository', () {
    test('reports available when GET /health answers ok', () async {
      final repository = repositoryWith(
        FakeAdapter.respond(200, {'status': 'ok'}),
      );

      expect(await repository.check(), ApiStatus.available);
    });

    test('reports unavailable when the API answers 503', () async {
      final repository = repositoryWith(
        FakeAdapter.respond(503, {
          'type': 'about:blank',
          'title': 'Service Unavailable',
          'status': 503,
        }, contentType: 'application/problem+json'),
      );

      expect(await repository.check(), ApiStatus.unavailable);
    });

    test('reports unavailable when the API cannot be reached', () async {
      final repository = repositoryWith(FakeAdapter.networkError());

      expect(await repository.check(), ApiStatus.unavailable);
    });
  });
}
