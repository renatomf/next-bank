import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/amount_integrity_interceptor.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/features/top_up/data/http_top_up_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../../support/scripted_server.dart';

const _topUpId = '0b9a7c1e-5d2f-4a8b-9c3d-7e6f5a4b3c2e';
// Generated, never a literal: a fixed UUID next to "key" looks like a secret.
final String _key = newIdempotencyKey();

HttpTopUpRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server
    // The app's own check on money (F-18), as main.dart wires it.
    ..interceptors.add(AmountIntegrityInterceptor());
  return HttpTopUpRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

Map<String, Object?> money(int cents) => {'amount': cents, 'currency': 'BRL'};

/// An operator as the API lists it; [changes] replace fields.
Map<String, Object?> operator([Map<String, Object?> changes = const {}]) => {
  'id': 'pulso-celular',
  'name': 'Pulso Celular',
  'initials': 'PC',
  'amounts': [money(1500), money(2000), money(3000), money(5000)],
  ...changes,
};

/// A top-up as the API sends it; [changes] replace fields.
Map<String, Object?> topUp([Map<String, Object?> changes = const {}]) => {
  'id': _topUpId,
  'operator': {
    'id': 'pulso-celular',
    'name': 'Pulso Celular',
    'initials': 'PC',
  },
  'phoneMasked': '(11) *****-0001',
  'amount': money(3000),
  'status': 'COMPLETED',
  'createdAt': '2026-10-21T15:04:00.000Z',
  ...changes,
};

Object? jsonOf(Object? body) => body is String ? jsonDecode(body) : body;

// The top-up routes of task 5a (v1.1.0 plan): the app only shows what the
// server sends, after checking it (F-18).
void main() {
  group('operators', () {
    test('reads the operators and the amounts each offers (D6)', () async {
      final server = ScriptedServer({
        '/v1/top-ups/operators': (_) async => JsonReply(200, {
          'operators': [operator()],
        }),
      });

      final operators = await repositoryFor(server).operators();

      expect(server.received.single.method, 'GET');
      final pulso = operators.single;
      expect(pulso.id, 'pulso-celular');
      expect(pulso.name, 'Pulso Celular');
      expect(pulso.initials, 'PC');
      expect(pulso.amountsCents, [1500, 2000, 3000, 5000]);
    });

    test('refuses an amount that is not positive', () async {
      final server = ScriptedServer({
        '/v1/top-ups/operators': (_) async => JsonReply(200, {
          'operators': [
            operator({
              'amounts': [money(0)],
            }),
          ],
        }),
      });

      await expectLater(
        repositoryFor(server).operators(),
        throwsA(isA<ApiUnexpected>()),
      );
    });
  });

  group('create', () {
    test('sends the digits, the amount and the PIN under the key', () async {
      final server = ScriptedServer({
        '/v1/top-ups': (_) async => JsonReply(201, topUp()),
      });

      final done = await repositoryFor(server).create(
        operatorId: 'pulso-celular',
        phoneDigits: '11900000001',
        amountCents: 3000,
        pin: '2580',
        idempotencyKey: _key,
      );

      final request = server.received.single;
      expect(request.method, 'POST');
      expect(request.headers['idempotency-key'], _key);
      expect(jsonOf(request.body), {
        'operatorId': 'pulso-celular',
        'phoneNumber': '11900000001',
        'amount': money(3000),
        'pin': '2580',
      });
      expect(done.id, _topUpId);
      expect(done.operatorName, 'Pulso Celular');
      expect(done.operatorInitials, 'PC');
      expect(done.phoneMasked, '(11) *****-0001');
      expect(done.amountCents, 3000);
      expect(done.createdAt, DateTime.utc(2026, 10, 21, 15, 4));
    });

    test('reports a catalog refusal with what is left of the limit', () async {
      final server = ScriptedServer({
        '/v1/top-ups': (_) async => ProblemReply(422, 'TopUpLimitExceeded', {
          'limit': money(20000),
          'remaining': money(1500),
        }),
      });

      await expectLater(
        repositoryFor(server).create(
          operatorId: 'pulso-celular',
          phoneDigits: '11900000001',
          amountCents: 3000,
          pin: '2580',
          idempotencyKey: _key,
        ),
        throwsA(
          isA<ApiRejected>()
              .having((f) => f.code, 'code', ApiErrorCode.topUpLimitExceeded)
              .having((f) => f.remainingCents, 'remaining', 1500),
        ),
      );
    });

    test('reports no answer as unreachable', () async {
      final server = ScriptedServer({
        '/v1/top-ups': (_) async => const NetworkFailure(),
      });

      await expectLater(
        repositoryFor(server).create(
          operatorId: 'pulso-celular',
          phoneDigits: '11900000001',
          amountCents: 3000,
          pin: '2580',
          idempotencyKey: _key,
        ),
        throwsA(isA<ApiUnreachable>()),
      );
    });
  });

  group('fetch', () {
    test('reads the receipt of a top-up', () async {
      final server = ScriptedServer({
        '/v1/top-ups/$_topUpId': (_) async => JsonReply(200, topUp()),
      });

      final receipt = await repositoryFor(server).fetch(_topUpId);

      expect(server.received.single.method, 'GET');
      expect(receipt.phoneMasked, '(11) *****-0001');
    });

    test("reports another customer's top-up as not found", () async {
      final server = ScriptedServer({
        '/v1/top-ups/$_topUpId': (_) async =>
            const ProblemReply(404, 'NotFound'),
      });

      await expectLater(
        repositoryFor(server).fetch(_topUpId),
        throwsA(
          isA<ApiRejected>().having(
            (f) => f.code,
            'code',
            ApiErrorCode.notFound,
          ),
        ),
      );
    });
  });

  // READ-02 and F-18: a receipt the app cannot trust is never shown.
  group('a top-up the app cannot trust', () {
    for (final (name, changes) in <(String, Map<String, Object?>)>[
      ('a number in full', {'phoneMasked': '(11) 90000-0001'}),
      ('a number without its mask', {'phoneMasked': '11900000001'}),
      ('a zero amount', {'amount': money(0)}),
      (
        'a fractional amount',
        {
          'amount': {'amount': 30.5, 'currency': 'BRL'},
        },
      ),
    ]) {
      test('is unexpected: $name', () async {
        final server = ScriptedServer({
          '/v1/top-ups/$_topUpId': (_) async => JsonReply(200, topUp(changes)),
        });

        await expectLater(
          repositoryFor(server).fetch(_topUpId),
          throwsA(isA<ApiUnexpected>()),
        );
      });
    }
  });
}
