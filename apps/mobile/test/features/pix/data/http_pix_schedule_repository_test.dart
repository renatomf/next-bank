import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/amount_integrity_interceptor.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/features/pix/data/http_pix_schedule_repository.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:nextbank_api/nextbank_api.dart' show NextbankApi;

import '../../../support/scripted_server.dart';

// The scheduled Pix over the generated client (v1.2.0 plan, task 7): what is
// sent, and what is read back, refusing what the server never sends (MASVS,
// code).
const _scheduleId = '0b9a7c1e-5d2f-4a8b-9c3d-7e6f5a4b3c2d';
const _transferId = '1c8b6d2f-4e3a-4b9c-8d2e-6f5a4b3c2d1e';
// Generated, never a literal: a fixed UUID next to "key" looks like a secret.
final String _key = newIdempotencyKey();
const PixKeyRef _cpfKey = (type: PixKeyType.cpf, value: '12345678909');

HttpPixScheduleRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server
    ..interceptors.add(AmountIntegrityInterceptor());
  return HttpPixScheduleRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

/// A schedule as the API sends it; [changes] replace fields.
Map<String, Object?> schedule([Map<String, Object?> changes = const {}]) => {
  'id': _scheduleId,
  'status': 'ACTIVE',
  'amount': {'amount': 15000, 'currency': 'BRL'},
  'description': 'Aluguel',
  'payee': {
    'name': 'Mariana Costa',
    'documentMasked': '***.456.789-**',
    'keyType': 'CPF',
    'keyMasked': '***.456.789-**',
  },
  'firstDate': '2026-11-05',
  'recurrence': {'frequency': 'MONTHLY', 'times': 3},
  'nextOccurrenceDate': '2026-11-05',
  'lastOccurrenceDate': '2027-01-05',
  'createdAt': '2026-10-27T15:00:00.000Z',
  'cancelledAt': null,
  ...changes,
};

/// An occurrence as the API sends it; [changes] replace fields.
Map<String, Object?> occurrence([Map<String, Object?> changes = const {}]) => {
  'sequence': 1,
  'date': '2026-11-05',
  'transferId': _transferId,
  'status': 'COMPLETED',
  'failureReason': null,
  ...changes,
};

Object? jsonOf(Object? body) => body is String ? jsonDecode(body) : body;

Future<PixSchedule> fetchWith(Map<String, Object?> body) => repositoryFor(
  ScriptedServer({
    '/v1/pix/schedules/$_scheduleId': (_) async => JsonReply(200, body),
  }),
).fetch(_scheduleId);

Future<PixSchedule> create(
  HttpPixScheduleRepository repository, {
  int times = 3,
}) => repository.create(
  key: _cpfKey,
  amountCents: 15000,
  description: 'Aluguel',
  firstDate: const CalendarDay(2026, 11, 5),
  times: times,
  pin: '2580',
  idempotencyKey: _key,
);

void main() {
  group('create', () {
    test(
      'schedules with the PIN and the key, and reads the schedule',
      () async {
        final server = ScriptedServer({
          '/v1/pix/schedules': (_) async => JsonReply(201, schedule()),
        });

        final created = await create(repositoryFor(server));

        final request = server.received.single;
        expect(request.method, 'POST');
        expect(request.headers['idempotency-key'], _key);
        expect(jsonOf(request.body), {
          'key': {'type': 'CPF', 'value': '12345678909'},
          'amount': {'amount': 15000, 'currency': 'BRL'},
          'description': 'Aluguel',
          'firstDate': '2026-11-05',
          'recurrence': {'frequency': 'MONTHLY', 'times': 3},
          'pin': '2580',
        });
        expect(created.id, _scheduleId);
        expect(created.status, PixScheduleStatus.active);
        expect(created.amountCents, 15000);
        expect(created.payee.name, 'Mariana Costa');
        expect(created.firstDate, const CalendarDay(2026, 11, 5));
        expect(created.frequency, ScheduleFrequency.monthly);
        expect(created.times, 3);
        expect(created.nextOccurrenceDate, const CalendarDay(2026, 11, 5));
        expect(created.lastOccurrenceDate, const CalendarDay(2027, 1, 5));
        expect(created.occurrences, isEmpty);
      },
    );

    test('schedules once without times', () async {
      final server = ScriptedServer({
        '/v1/pix/schedules': (_) async => JsonReply(
          201,
          schedule({
            'recurrence': {'frequency': 'ONCE', 'times': 1},
            'lastOccurrenceDate': '2026-11-05',
          }),
        ),
      });

      final created = await create(repositoryFor(server), times: 1);

      final body = jsonOf(server.received.single.body)! as Map<String, Object?>;
      expect(body['recurrence'], {'frequency': 'ONCE'});
      expect(created.frequency, ScheduleFrequency.once);
      expect(created.times, 1);
    });

    test('reports a wrong PIN with the attempts left', () async {
      final server = ScriptedServer({
        '/v1/pix/schedules': (_) async =>
            const ProblemReply(422, 'PinIncorrect', {'remainingAttempts': 4}),
      });

      await expectLater(
        create(repositoryFor(server)),
        throwsA(
          isA<ApiRejected>()
              .having((f) => f.code, 'code', ApiErrorCode.pinIncorrect)
              .having((f) => f.remainingAttempts, 'attempts', 4),
        ),
      );
    });

    test('reports a lost answer as unreachable', () async {
      final server = ScriptedServer({
        '/v1/pix/schedules': (_) async => const NetworkFailure(),
      });

      await expectLater(
        create(repositoryFor(server)),
        throwsA(isA<ApiUnreachable>()),
      );
    });
  });

  group('list', () {
    test(
      'reads a page and where the next starts, sending the cursor',
      () async {
        final queries = <Map<String, dynamic>>[];
        final server = ScriptedServer({
          '/v1/pix/schedules': (request) async {
            queries.add(request.queryParameters);
            return JsonReply(200, {
              'items': [schedule()],
              'nextCursor': 'abc',
            });
          },
        });

        final page = await repositoryFor(server).list(cursor: 'xyz');

        expect(queries.single, {'cursor': 'xyz'});
        expect(page.items.single.id, _scheduleId);
        expect(page.nextCursor, 'abc');
      },
    );

    test('asks for the first page without a cursor', () async {
      final queries = <Map<String, dynamic>>[];
      final server = ScriptedServer({
        '/v1/pix/schedules': (request) async {
          queries.add(request.queryParameters);
          return const JsonReply(200, {'items': [], 'nextCursor': null});
        },
      });

      final page = await repositoryFor(server).list();

      expect(queries.single, isEmpty);
      expect(page.items, isEmpty);
      expect(page.nextCursor, isNull);
    });
  });

  group('fetch', () {
    test('reads the occurrences with what each Pix became', () async {
      final found = await fetchWith({
        ...schedule({'nextOccurrenceDate': '2026-12-05'}),
        'occurrences': [
          occurrence({
            'status': 'FAILED',
            'failureReason': 'INSUFFICIENT_FUNDS',
          }),
        ],
      });

      final only = found.occurrences.single;
      expect(only.sequence, 1);
      expect(only.date, const CalendarDay(2026, 11, 5));
      expect(only.transferId, _transferId);
      expect(only.status, PixStatus.failed);
      expect(only.failureReason, PixFailureReason.insufficientFunds);
    });

    test('takes a status or a frequency a later API adds', () async {
      final found = await fetchWith({
        ...schedule({
          'status': 'PAUSED',
          'recurrence': {'frequency': 'WEEKLY', 'times': 4},
        }),
        'occurrences': <Object?>[],
      });

      expect(found.status, PixScheduleStatus.unknown);
      expect(found.frequency, ScheduleFrequency.other);
    });

    // MASVS, code: what the server never sends is refused, not shown.
    for (final (name, changes) in <(String, Map<String, Object?>)>[
      (
        'an amount in another currency',
        {
          'amount': {'amount': 15000, 'currency': 'USD'},
        },
      ),
      (
        'an amount that is not positive',
        {
          'amount': {'amount': 0, 'currency': 'BRL'},
        },
      ),
      ('a day that does not exist', {'firstDate': '2026-02-30'}),
      ('an active schedule with no next date', {'nextOccurrenceDate': null}),
      (
        'an ended schedule with a next date',
        {'status': 'CANCELLED', 'cancelledAt': '2026-10-28T15:00:00.000Z'},
      ),
    ]) {
      test('refuses $name', () async {
        await expectLater(
          fetchWith({...schedule(changes), 'occurrences': <Object?>[]}),
          throwsA(isA<ApiUnexpected>()),
        );
      });
    }

    for (final (name, changes) in <(String, Map<String, Object?>)>[
      ('a failed occurrence without a reason', {'status': 'FAILED'}),
      ('an occurrence in a status the Pix has not', {'status': 'LOST'}),
    ]) {
      test('refuses $name', () async {
        await expectLater(
          fetchWith({
            ...schedule(),
            'occurrences': [occurrence(changes)],
          }),
          throwsA(isA<ApiUnexpected>()),
        );
      });
    }
  });

  group('cancel', () {
    test('cancels and reads the schedule ended', () async {
      final server = ScriptedServer({
        '/v1/pix/schedules/$_scheduleId/cancel': (_) async => JsonReply(
          200,
          schedule({
            'status': 'CANCELLED',
            'nextOccurrenceDate': null,
            'cancelledAt': '2026-10-28T15:00:00.000Z',
          }),
        ),
      });

      final cancelled = await repositoryFor(server).cancel(_scheduleId);

      expect(server.received.single.method, 'POST');
      expect(cancelled.status, PixScheduleStatus.cancelled);
      expect(cancelled.nextOccurrenceDate, isNull);
    });

    test('reports a finished schedule', () async {
      final server = ScriptedServer({
        '/v1/pix/schedules/$_scheduleId/cancel': (_) async =>
            const ProblemReply(409, 'ScheduleNotActive'),
      });

      await expectLater(
        repositoryFor(server).cancel(_scheduleId),
        throwsA(
          isA<ApiRejected>().having(
            (f) => f.code,
            'code',
            ApiErrorCode.scheduleNotActive,
          ),
        ),
      );
    });
  });
}
