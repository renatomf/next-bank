import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/features/pix/data/http_pix_repository.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../../support/scripted_server.dart';

const _transferId = '0b9a7c1e-5d2f-4a8b-9c3d-7e6f5a4b3c2d';
// Generated, never a literal: a fixed UUID next to "key" looks like a secret.
final String _key = newIdempotencyKey();
const _transferPath = '/v1/pix/transfers/$_transferId';

HttpPixRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server;
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

      final payee = await repositoryFor(server).lookup('12345678909');

      final request = server.received.single;
      expect(request.method, 'POST');
      expect(jsonOf(request.body), {'type': 'CPF', 'value': '12345678909'});
      expect(payee.name, 'Mariana Costa');
      expect(payee.documentMasked, '***.456.789-**');
      expect(payee.keyType, PixKeyType.cpf);
      expect(payee.keyMasked, '***.456.789-**');
    });

    test('reports a key that does not exist', () async {
      final server = ScriptedServer({
        '/v1/pix/key-lookups': (_) async =>
            const ProblemReply(404, 'PixKeyNotFound'),
      });

      await expectLater(
        repositoryFor(server).lookup('12345678909'),
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
        cpf: '12345678909',
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

    test('leaves out a missing description', () async {
      final server = ScriptedServer({
        '/v1/pix/transfers': (_) async => JsonReply(201, pixTransfer()),
      });

      await repositoryFor(server).create(
        cpf: '12345678909',
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
        cpf: '12345678909',
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
          cpf: '12345678909',
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
}
