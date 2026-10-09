import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/amount_integrity_interceptor.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/statement/http_statement_repository.dart';
import 'package:next_bank/core/statement/statement_item.dart';
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

    final result = await repositoryFor(server).page('next-1');

    expect(result.items, isEmpty);
    expect(result.nextCursor, isNull);
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

  test('reports a cursor the server refused', () async {
    final server = ScriptedServer({
      _path: (_) async => const ProblemReply(422, 'InvalidRequest'),
    });

    await expectLater(
      repositoryFor(server).page('bad'),
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
