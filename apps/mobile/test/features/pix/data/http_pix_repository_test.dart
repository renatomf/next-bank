import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/amount_integrity_interceptor.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/features/pix/data/http_pix_repository.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../../support/scripted_server.dart';

const _transferId = '0b9a7c1e-5d2f-4a8b-9c3d-7e6f5a4b3c2d';
// Generated, never a literal: a fixed UUID next to "key" looks like a secret.
final String _key = newIdempotencyKey();
// A random Pix key is a UUID v4 too: generated for the same reason.
final String _receivingKey = newIdempotencyKey();
const PixKeyRef _cpfKey = (type: PixKeyType.cpf, value: '12345678909');
String _masked(String key) =>
    '${key.substring(0, 4)}****-****-****-****-********${key.substring(32)}';
const _transferPath = '/v1/pix/transfers/$_transferId';

HttpPixRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server
    // The app's own check on money (F-18), as main.dart wires it: without it
    // these tests missed that it refused every Pix and statement answer.
    ..interceptors.add(AmountIntegrityInterceptor());
  return HttpPixRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

/// A Pix as the API sends it; [changes] replace fields.
Map<String, Object?> pixTransfer([Map<String, Object?> changes = const {}]) => {
  'id': _transferId,
  'status': 'AWAITING_AUTH',
  'amount': {'amount': 35000, 'currency': 'BRL'},
  'description': 'Aluguel de outubro',
  'payee': {
    'name': 'Mariana Costa',
    'documentMasked': '***.456.789-**',
    'keyType': 'CPF',
    'keyMasked': '***.456.789-**',
  },
  'endToEndId': null,
  'failureReason': null,
  'createdAt': '2026-10-08T17:32:00.000Z',
  'expiresAt': '2026-10-08T17:42:00.000Z',
  'completedAt': null,
  ...changes,
};

Object? jsonOf(Object? body) => body is String ? jsonDecode(body) : body;

Matcher rejectedWith(ApiErrorCode code) =>
    throwsA(isA<ApiRejected>().having((f) => f.code, 'code', code));

void main() {
  group('lookup', () {
    test('asks for the CPF key and reads the payee', () async {
      final server = ScriptedServer({
        '/v1/pix/key-lookups': (_) async => const JsonReply(200, {
          'keyType': 'CPF',
          'keyMasked': '***.456.789-**',
          'payeeName': 'Mariana Costa',
          'payeeDocumentMasked': '***.456.789-**',
        }),
      });

      final payee = await repositoryFor(server).lookup(_cpfKey);

      final request = server.received.single;
      expect(request.method, 'POST');
      expect(jsonOf(request.body), {'type': 'CPF', 'value': '12345678909'});
      expect(payee.name, 'Mariana Costa');
      expect(payee.documentMasked, '***.456.789-**');
      expect(payee.keyType, PixKeyType.cpf);
      expect(payee.keyMasked, '***.456.789-**');
    });

    // A key read from a QR Code (v1.1.0 plan, task 4).
    test('asks for a random key with its type', () async {
      final server = ScriptedServer({
        '/v1/pix/key-lookups': (_) async => JsonReply(200, {
          'keyType': 'RANDOM',
          'keyMasked': _masked(_receivingKey),
          'payeeName': 'Bruno Lima',
          'payeeDocumentMasked': '***.982.247-**',
        }),
      });

      final payee = await repositoryFor(server)
          .lookup((type: PixKeyType.random, value: _receivingKey));

      expect(jsonOf(server.received.single.body), {
        'type': 'RANDOM',
        'value': _receivingKey,
      });
      expect(payee.keyType, PixKeyType.random);
    });

    test('reports a key that does not exist', () async {
      final server = ScriptedServer({
        '/v1/pix/key-lookups': (_) async =>
            const ProblemReply(404, 'PixKeyNotFound'),
      });

      await expectLater(
        repositoryFor(server).lookup(_cpfKey),
        rejectedWith(ApiErrorCode.pixKeyNotFound),
      );
    });
  });

  group('create', () {
    // ADR 0007: the key goes in the header; the body has only what was asked,
    // in integer cents (PIX-04).
    test('sends the key, the amount in cents and the description', () async {
      final server = ScriptedServer({
        '/v1/pix/transfers': (_) async => JsonReply(201, pixTransfer()),
      });

      await repositoryFor(server).create(
        key: _cpfKey,
        amountCents: 35000,
        description: 'Aluguel de outubro',
        idempotencyKey: _key,
      );

      final request = server.received.single;
      expect(request.method, 'POST');
      expect(request.headers['idempotency-key'], _key);
      expect(jsonOf(request.body), {
        'key': {'type': 'CPF', 'value': '12345678909'},
        'amount': {'amount': 35000, 'currency': 'BRL'},
        'description': 'Aluguel de outubro',
      });
    });

    test('sends a random key with its type', () async {
      final server = ScriptedServer({
        '/v1/pix/transfers': (_) async => JsonReply(201, pixTransfer()),
      });

      await repositoryFor(server).create(
        key: (type: PixKeyType.random, value: _receivingKey),
        amountCents: 2500,
        description: null,
        idempotencyKey: _key,
      );

      expect(
        (jsonOf(server.received.single.body)! as Map<String, Object?>)['key'],
        {'type': 'RANDOM', 'value': _receivingKey},
      );
    });

    test('leaves out a missing description', () async {
      final server = ScriptedServer({
        '/v1/pix/transfers': (_) async => JsonReply(201, pixTransfer()),
      });

      await repositoryFor(server).create(
        key: _cpfKey,
        amountCents: 1,
        description: null,
        idempotencyKey: _key,
      );

      expect(
        jsonOf(server.received.single.body),
        isNot(contains('description')),
      );
    });

    test('reads the Pix waiting for the PIN', () async {
      final server = ScriptedServer({
        '/v1/pix/transfers': (_) async => JsonReply(201, pixTransfer()),
      });

      final transfer = await repositoryFor(server).create(
        key: _cpfKey,
        amountCents: 35000,
        description: 'Aluguel de outubro',
        idempotencyKey: _key,
      );

      expect(transfer.id, _transferId);
      expect(transfer.status, PixStatus.awaitingAuth);
      expect(transfer.amountCents, 35000);
      expect(transfer.description, 'Aluguel de outubro');
      expect(transfer.payee.name, 'Mariana Costa');
      expect(transfer.createdAt, DateTime.utc(2026, 10, 8, 17, 32));
      expect(transfer.endToEndId, isNull);
    });

    test('reports an amount over the limit with the limit', () async {
      final server = ScriptedServer({
        '/v1/pix/transfers': (_) async =>
            const ProblemReply(422, 'LimitExceeded', {
              'limit': {'amount': 100000, 'currency': 'BRL'},
            }),
      });

      await expectLater(
        repositoryFor(server).create(
          key: _cpfKey,
          amountCents: 200000,
          description: null,
          idempotencyKey: _key,
        ),
        throwsA(
          isA<ApiRejected>().having((f) => f.limitCents, 'limit', 100000),
        ),
      );
    });
  });

  group('fetch', () {
    test('reads the Pix by its id', () async {
      final server = ScriptedServer({
        _transferPath: (_) async => JsonReply(200, pixTransfer()),
      });

      final transfer = await repositoryFor(server).fetch(_transferId);

      expect(server.received.single.method, 'GET');
      expect(transfer.id, _transferId);
    });

    // PIX-01: another customer's Pix is not found.
    test('reports a Pix that is not found', () async {
      final server = ScriptedServer({
        _transferPath: (_) async => const ProblemReply(404, 'NotFound'),
      });

      await expectLater(
        repositoryFor(server).fetch(_transferId),
        rejectedWith(ApiErrorCode.notFound),
      );
    });
  });

  group('authorize', () {
    // PIX-06: the PIN goes only in the body, to be checked on the server.
    test('sends the PIN with the key of the attempt', () async {
      final server = ScriptedServer({
        '$_transferPath/authorize': (_) async =>
            JsonReply(200, pixTransfer({'status': 'COMPLETED'})),
      });

      await repositoryFor(
        server,
      ).authorize(transferId: _transferId, pin: '2580', idempotencyKey: _key);

      final request = server.received.single;
      expect(request.method, 'POST');
      expect(request.headers['idempotency-key'], _key);
      expect(jsonOf(request.body), {'pin': '2580'});
    });

    test('reads a completed Pix with its end-to-end id', () async {
      final server = ScriptedServer({
        '$_transferPath/authorize': (_) async => JsonReply(
          200,
          pixTransfer({
            'status': 'COMPLETED',
            'endToEndId': 'E00000000202610081732a8F3k9QpZ2x',
            'completedAt': '2026-10-08T17:33:00.000Z',
          }),
        ),
      });

      final transfer = await repositoryFor(
        server,
      ).authorize(transferId: _transferId, pin: '2580', idempotencyKey: _key);

      expect(transfer.status, PixStatus.completed);
      expect(transfer.endToEndId, 'E00000000202610081732a8F3k9QpZ2x');
      expect(transfer.completedAt, DateTime.utc(2026, 10, 8, 17, 33));
      expect(transfer.failureReason, isNull);
    });

    // domain-model.md 9: a Pix that failed is an answer, not an error.
    for (final (wire, reason) in [
      ('INSUFFICIENT_FUNDS', PixFailureReason.insufficientFunds),
      ('LIMIT_EXCEEDED', PixFailureReason.limitExceeded),
      ('PAYEE_UNAVAILABLE', PixFailureReason.payeeUnavailable),
      ('ACCOUNT_BLOCKED', PixFailureReason.accountBlocked),
    ]) {
      test('reads a Pix that failed with $wire', () async {
        final server = ScriptedServer({
          '$_transferPath/authorize': (_) async => JsonReply(
            200,
            pixTransfer({'status': 'FAILED', 'failureReason': wire}),
          ),
        });

        final transfer = await repositoryFor(
          server,
        ).authorize(transferId: _transferId, pin: '2580', idempotencyKey: _key);

        expect(transfer.status, PixStatus.failed);
        expect(transfer.failureReason, reason);
      });
    }

    test('reports a wrong PIN with the attempts left', () async {
      final server = ScriptedServer({
        '$_transferPath/authorize': (_) async =>
            const ProblemReply(422, 'PinIncorrect', {'remainingAttempts': 4}),
      });

      await expectLater(
        repositoryFor(
          server,
        ).authorize(transferId: _transferId, pin: '7413', idempotencyKey: _key),
        throwsA(
          isA<ApiRejected>()
              .having((f) => f.code, 'code', ApiErrorCode.pinIncorrect)
              .having((f) => f.remainingAttempts, 'remainingAttempts', 4),
        ),
      );
    });

    test('reports no answer as unreachable', () async {
      final server = ScriptedServer({
        '$_transferPath/authorize': (_) async => const NetworkFailure(),
      });

      await expectLater(
        repositoryFor(
          server,
        ).authorize(transferId: _transferId, pin: '2580', idempotencyKey: _key),
        throwsA(isA<ApiUnreachable>()),
      );
    });
  });

  // MASVS, code: what the API sends is checked before it is shown (F-18).
  group('an answer the app cannot trust', () {
    for (final (name, changes) in <(String, Map<String, Object?>)>[
      ('an unknown status', {'status': 'REVERSED'}),
      (
        'an unknown failure reason',
        {'status': 'FAILED', 'failureReason': 'SOMETHING_NEW'},
      ),
      ('a failed Pix without a reason', {'status': 'FAILED'}),
      // The app shows the refusal of another bank from v1.2.0 task 5; until then
      // it never reaches a customer, as the Pix to other banks stays off (W4).
      (
        'a refusal by the payee bank, before the app shows it',
        {'status': 'FAILED', 'failureReason': 'PAYEE_BANK_REJECTED'},
      ),
      (
        'a zero amount',
        {
          'amount': {'amount': 0, 'currency': 'BRL'},
        },
      ),
      (
        'a negative amount',
        {
          'amount': {'amount': -35000, 'currency': 'BRL'},
        },
      ),
    ]) {
      test('is unexpected: $name', () async {
        final server = ScriptedServer({
          _transferPath: (_) async => JsonReply(200, pixTransfer(changes)),
        });

        await expectLater(
          repositoryFor(server).fetch(_transferId),
          throwsA(isA<ApiUnexpected>()),
        );
      });
    }
  });

  // The customer's random key, for the QR Code (v1.1.0 plan, task 3).
  group('receivingKey', () {
    test("asks for the caller's key, without a body, and reads it", () async {
      final server = ScriptedServer({
        '/v1/me/pix/receiving-key': (_) async => JsonReply(200, {
          'key': _receivingKey,
          'keyMasked': _masked(_receivingKey),
        }),
      });

      final key = await repositoryFor(server).receivingKey();

      final request = server.received.single;
      expect(request.method, 'POST');
      expect(request.body, anyOf(isNull, isEmpty));
      expect(key.key, _receivingKey);
      expect(key.keyMasked, _masked(_receivingKey));
    });

    // Only a random key may go in a QR Code: never a CPF (PIX-12; MASVS, code).
    for (final (name, key) in [
      ('a CPF', '12345678909'),
      ('a UUID that is not v4', '019a0b6e-7c3d-7f00-8a1b-2c3d4e5f6a7b'),
    ]) {
      test('is unexpected: $name as the key', () async {
        final server = ScriptedServer({
          '/v1/me/pix/receiving-key': (_) async =>
              JsonReply(200, {'key': key, 'keyMasked': '****'}),
        });

        await expectLater(
          repositoryFor(server).receivingKey(),
          throwsA(isA<ApiUnexpected>()),
        );
      });
    }

    test('reports a session that ended', () async {
      final server = ScriptedServer({
        '/v1/me/pix/receiving-key': (_) async =>
            const ProblemReply(401, 'Unauthenticated'),
      });

      await expectLater(
        repositoryFor(server).receivingKey(),
        throwsA(isA<ApiFailure>()),
      );
    });
  });
}
