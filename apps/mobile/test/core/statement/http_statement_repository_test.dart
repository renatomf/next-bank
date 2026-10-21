import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/amount_integrity_interceptor.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/statement/http_statement_repository.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_query.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../support/scripted_server.dart';

const _path = '/v1/me/statement';
const _transferId = '0b9a7c1e-5d2f-4a8b-9c3d-7e6f5a4b3c2d';

HttpStatementRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server
    // The app's own check on money (F-18), as main.dart wires it: without it
    // these tests missed that it refused every Pix and statement answer.
    ..interceptors.add(AmountIntegrityInterceptor());
  return HttpStatementRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

/// A Pix sent, as the API lists it; [changes] replace fields.
Map<String, Object?> sentItem([Map<String, Object?> changes = const {}]) => {
  'id': '7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d',
  'occurredAt': '2026-10-08T17:32:00.000Z',
  'kind': 'PIX_SENT',
  'direction': 'OUT',
  'amount': {'amount': 35000, 'currency': 'BRL'},
  'counterparty': {'name': 'Mariana Costa', 'documentMasked': '***.456.789-**'},
  'transferId': _transferId,
  'topUpId': null,
  ...changes,
};

Map<String, Object?> page(
  List<Map<String, Object?>> items, [
  String? nextCursor,
]) => {'items': items, 'nextCursor': nextCursor};

// GET /v1/me/statement (domain-model.md 8.1): one page of the account in the
// token, newest first; the app only reads what it is given.
void main() {
  test('reads the first page without a cursor', () async {
    final server = ScriptedServer({
      _path: (request) async {
        expect(request.queryParameters, isEmpty);
        return JsonReply(200, page([sentItem()], 'next-1'));
      },
    });

    final result = await repositoryFor(server).page();

    final request = server.received.single;
    expect(request.method, 'GET');
    expect(result.nextCursor, 'next-1');
    final item = result.items.single;
    expect(item.id, '7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d');
    expect(item.occurredAt, DateTime.utc(2026, 10, 8, 17, 32));
    expect(item.kind, StatementKind.pixSent);
    expect(item.direction, MoneyDirection.outgoing);
    expect(item.amountCents, 35000);
    expect(item.counterparty?.name, 'Mariana Costa');
    expect(item.counterparty?.documentMasked, '***.456.789-**');
    expect(item.transferId, _transferId);
  });

  test('asks the next page with the cursor it was given', () async {
    final server = ScriptedServer({
      _path: (request) async {
        expect(request.queryParameters['cursor'], 'next-1');
        return JsonReply(200, page([]));
      },
    });

    final result = await repositoryFor(server).page(cursor: 'next-1');

    expect(result.items, isEmpty);
    expect(result.nextCursor, isNull);
  });

  // v1.1.0 plan, task 4.1: the filter and the search go to the server (X1).
  for (final (filter, sent) in [
    (StatementFilter.incoming, 'IN'),
    (StatementFilter.outgoing, 'OUT'),
    (StatementFilter.pix, 'PIX'),
    (StatementFilter.receipt, 'RECEIPT'),
  ]) {
    test('asks the server for $filter as $sent, with the search', () async {
      final server = ScriptedServer({
        _path: (request) async {
          expect(request.queryParameters['filter'], sent);
          expect(request.queryParameters['q'], 'mari');
          return JsonReply(200, page([]));
        },
      });

      await repositoryFor(server).page(query: (filter: filter, search: 'mari'));

      expect(server.received, hasLength(1));
    });
  }

  test('sends neither filter nor search for the whole statement', () async {
    final server = ScriptedServer({
      _path: (request) async {
        expect(request.queryParameters.containsKey('filter'), isFalse);
        expect(request.queryParameters.containsKey('q'), isFalse);
        return JsonReply(200, page([]));
      },
    });

    await repositoryFor(server).page();

    expect(server.received, hasLength(1));
  });

  test('reads a Pix received and the demo funding', () async {
    final server = ScriptedServer({
      _path: (_) async => JsonReply(
        200,
        page([
          sentItem({
            'kind': 'PIX_RECEIVED',
            'direction': 'IN',
            'transferId': null,
          }),
          sentItem({
            'kind': 'DEMO_FUNDING',
            'direction': 'IN',
            'counterparty': null,
            'transferId': null,
          }),
        ]),
      ),
    });

    final items = (await repositoryFor(server).page()).items;

    expect(items[0].kind, StatementKind.pixReceived);
    expect(items[0].direction, MoneyDirection.incoming);
    expect(items[1].kind, StatementKind.demoFunding);
    expect(items[1].counterparty, isNull);
  });

  // v1.1.0 plan, task 5: a phone top-up leaves the account, with the operator
  // and the masked number as its counterparty.
  test('reads a phone top-up going out', () async {
    final server = ScriptedServer({
      _path: (_) async => JsonReply(
        200,
        page([
          sentItem({
            'kind': 'TOP_UP',
            'counterparty': {
              'name': 'Pulso Celular',
              'documentMasked': '(11) *****-0001',
            },
            'transferId': null,
            'topUpId': '0b9a7c1e-5d2f-4a8b-9c3d-7e6f5a4b3c2e',
          }),
        ]),
      ),
    });

    final item = (await repositoryFor(server).page()).items.single;

    expect(item.kind, StatementKind.topUp);
    expect(item.direction, MoneyDirection.outgoing);
    expect(item.counterparty?.name, 'Pulso Celular');
    expect(item.transferId, isNull);
  });

  test('reports a cursor the server refused', () async {
    final server = ScriptedServer({
      _path: (_) async => const ProblemReply(422, 'InvalidRequest'),
    });

    await expectLater(
      repositoryFor(server).page(cursor: 'bad'),
      throwsA(
        isA<ApiRejected>().having(
          (f) => f.code,
          'code',
          ApiErrorCode.invalidRequest,
        ),
      ),
    );
  });

  test('reports no answer as unreachable', () async {
    final server = ScriptedServer({_path: (_) async => const NetworkFailure()});

    await expectLater(
      repositoryFor(server).page(),
      throwsA(isA<ApiUnreachable>()),
    );
  });

  // MASVS, code (F-18) and READ-02: what the API sends is checked before it is
  // shown; one item the app cannot trust spoils the page.
  group('an item the app cannot trust', () {
    for (final (name, changes) in <(String, Map<String, Object?>)>[
      ('an unknown kind', {'kind': 'REFUND'}),
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
      ('a Pix sent coming in', {'direction': 'IN'}),
      (
        'a Pix received going out',
        {'kind': 'PIX_RECEIVED', 'transferId': null},
      ),
      (
        'a receipt link on a Pix received',
        {'kind': 'PIX_RECEIVED', 'direction': 'IN'},
      ),
      ('a top-up coming in', {'kind': 'TOP_UP', 'direction': 'IN'}),
      ('a Pix receipt link on a top-up', {'kind': 'TOP_UP'}),
    ]) {
      test('is unexpected: $name', () async {
        final server = ScriptedServer({
          _path: (_) async => JsonReply(200, page([sentItem(changes)])),
        });

        await expectLater(
          repositoryFor(server).page(),
          throwsA(isA<ApiUnexpected>()),
        );
      });
    }
  });
}
