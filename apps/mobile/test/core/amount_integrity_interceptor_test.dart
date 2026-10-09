import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/amount_integrity_interceptor.dart';

import '../support/scripted_server.dart';

Dio dioFor(ScriptedServer server) =>
    Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..httpClientAdapter = server
      ..interceptors.add(AmountIntegrityInterceptor());

// Money arrives as integer cents (ADR 0006, D1). The generated client turns
// any number into an int with toInt(), so 10.5 would silently become 10: the
// app refuses such an answer before it is read (finding F-18; MASVS, code).
void main() {
  group('AmountIntegrityInterceptor', () {
    test('lets integer amounts through, however deep', () async {
      final server = ScriptedServer({
        '/v1/me/account': (_) async => const JsonReply(200, {
          'availableBalance': {'amount': 1000000, 'currency': 'BRL'},
          'items': [
            {'amount': 5},
          ],
        }),
      });

      final response = await dioFor(server).get<Object?>('/v1/me/account');

      expect(response.statusCode, 200);
    });

    // A Pix and a statement item carry their Money under the name "amount":
    // found on a device against the real API, where every Pix and statement
    // answer was refused.
    test('lets a Money named amount through', () async {
      final server = ScriptedServer({
        '/v1/me/statement': (_) async => const JsonReply(200, {
          'items': [
            {
              'amount': {'amount': 1000000, 'currency': 'BRL'},
            },
          ],
        }),
      });

      final response = await dioFor(server).get<Object?>('/v1/me/statement');

      expect(response.statusCode, 200);
    });

    test('refuses a fraction inside a Money named amount', () async {
      final server = ScriptedServer({
        '/v1/me/statement': (_) async => const JsonReply(200, {
          'items': [
            {
              'amount': {'amount': 10.5, 'currency': 'BRL'},
            },
          ],
        }),
      });

      await expectLater(
        dioFor(server).get<Object?>('/v1/me/statement'),
        throwsA(isA<DioException>()),
      );
    });

    for (final (name, amount) in [
      ('a fraction', 10.5),
      ('a whole number written as a decimal', 10.0),
      ('text', '10'),
    ]) {
      test('refuses $name as an amount', () async {
        final server = ScriptedServer({
          '/v1/me/account': (_) async => JsonReply(200, {
            'availableBalance': {'amount': amount, 'currency': 'BRL'},
          }),
        });

        await expectLater(
          dioFor(server).get<Object?>('/v1/me/account'),
          throwsA(
            isA<DioException>().having(
              (e) => e.type,
              'type',
              DioExceptionType.unknown,
            ),
          ),
        );
      });
    }

    test('refuses a fraction nested in a list', () async {
      final server = ScriptedServer({
        '/v1/statement': (_) async => const JsonReply(200, {
          'items': [
            {'amount': 100},
            {'amount': 99.99},
          ],
        }),
      });

      await expectLater(
        dioFor(server).get<Object?>('/v1/statement'),
        throwsA(isA<DioException>()),
      );
    });
  });
}
