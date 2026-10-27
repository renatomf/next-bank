import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';

import '../support/scripted_server.dart';

// API errors become one sealed type the app reacts to (CLAUDE.md, section 4;
// domain-model.md, section 9).
Future<Object> failureFor(Reply reply) async {
  final dio = Dio()
    ..httpClientAdapter = ScriptedServer({'/x': (_) async => reply});
  try {
    await dio.get<void>('/x');
  } on DioException catch (error) {
    return apiFailureOf(error);
  }
  fail('the request should have failed');
}

void main() {
  group('apiFailureOf', () {
    for (final (wire, code) in [
      ('InvalidCpf', ApiErrorCode.invalidCpf),
      ('WeakPassword', ApiErrorCode.weakPassword),
      ('AlreadyRegistered', ApiErrorCode.alreadyRegistered),
      ('InvalidCredentials', ApiErrorCode.invalidCredentials),
      ('TooManyAttempts', ApiErrorCode.tooManyAttempts),
      ('InvalidRequest', ApiErrorCode.invalidRequest),
      ('Unauthenticated', ApiErrorCode.unauthenticated),
      ('SessionExpired', ApiErrorCode.sessionExpired),
      ('RefreshTokenReuseDetected', ApiErrorCode.refreshTokenReuseDetected),
      ('InvalidPin', ApiErrorCode.invalidPin),
      ('PinAlreadyCreated', ApiErrorCode.pinAlreadyCreated),
      ('NotFound', ApiErrorCode.notFound),
      ('PasswordIncorrect', ApiErrorCode.passwordIncorrect),
      ('PixKeyNotFound', ApiErrorCode.pixKeyNotFound),
      ('SamePayerAndPayee', ApiErrorCode.samePayerAndPayee),
      ('InvalidAmount', ApiErrorCode.invalidAmount),
      ('InsufficientFunds', ApiErrorCode.insufficientFunds),
      ('LimitExceeded', ApiErrorCode.limitExceeded),
      ('AccountBlocked', ApiErrorCode.accountBlocked),
      ('TransferExpired', ApiErrorCode.transferExpired),
      ('InvalidTransferState', ApiErrorCode.invalidTransferState),
      ('IdempotencyKeyReused', ApiErrorCode.idempotencyKeyReused),
      ('RequestInProgress', ApiErrorCode.requestInProgress),
      ('InvalidPhoneNumber', ApiErrorCode.invalidPhoneNumber),
      ('UnknownTopUpOperator', ApiErrorCode.unknownTopUpOperator),
      ('InvalidTopUpAmount', ApiErrorCode.invalidTopUpAmount),
      ('TopUpLimitExceeded', ApiErrorCode.topUpLimitExceeded),
      // The scheduled Pix (v1.2.0 plan, task 7).
      ('ScheduleInPast', ApiErrorCode.scheduleInPast),
      ('InvalidRecurrence', ApiErrorCode.invalidRecurrence),
      ('ScheduleNotActive', ApiErrorCode.scheduleNotActive),
    ]) {
      test('maps $wire to its catalog code', () async {
        final failure = await failureFor(ProblemReply(422, wire));

        expect(failure, isA<ApiRejected>());
        expect((failure as ApiRejected).code, code);
      });
    }

    // DEMO-03: a shared demo account refused with 403, which keeps the
    // visitor signed in.
    test('maps a demo account refusal to its catalog code', () async {
      final failure = await failureFor(
        const ProblemReply(403, 'DemoAccountRestricted'),
      );

      expect(failure, isA<ApiRejected>());
      expect((failure as ApiRejected).code, ApiErrorCode.demoAccountRestricted);
    });

    // F-16, PIX-05: the Unlock screen tells how many attempts are left.
    test('keeps the attempts left of a wrong PIN', () async {
      final failure = await failureFor(
        const ProblemReply(422, 'PinIncorrect', {'remainingAttempts': 3}),
      );

      expect(failure, isA<ApiRejected>());
      expect((failure as ApiRejected).remainingAttempts, 3);
    });

    test('ignores attempts left that are not a whole number', () async {
      final failure = await failureFor(
        const ProblemReply(422, 'PinIncorrect', {'remainingAttempts': '3'}),
      );

      expect((failure as ApiRejected).remainingAttempts, isNull);
    });

    // The Pix screen tells which limit the amount went over.
    test('keeps the limit of an amount over it, in cents', () async {
      final failure = await failureFor(
        const ProblemReply(422, 'LimitExceeded', {
          'limit': {'amount': 100000, 'currency': 'BRL'},
        }),
      );

      expect((failure as ApiRejected).limitCents, 100000);
    });

    // The top-up screen tells the day's limit and what is left of it.
    test('keeps the daily top-up limit and what is left, in cents', () async {
      final failure = await failureFor(
        const ProblemReply(422, 'TopUpLimitExceeded', {
          'limit': {'amount': 20000, 'currency': 'BRL'},
          'remaining': {'amount': 1500, 'currency': 'BRL'},
        }),
      );

      expect((failure as ApiRejected).limitCents, 20000);
      expect(failure.remainingCents, 1500);
    });

    test('ignores what is left when it is not money in reais', () async {
      final failure = await failureFor(
        const ProblemReply(422, 'TopUpLimitExceeded', {
          'remaining': {'amount': 1500.5, 'currency': 'BRL'},
        }),
      );

      expect((failure as ApiRejected).remainingCents, isNull);
    });

    // F-18: money from the API is whole cents in reais, never a fraction.
    for (final limit in <Object>[
      {'amount': 1000.5, 'currency': 'BRL'},
      {'amount': -1, 'currency': 'BRL'},
      {'amount': 100000, 'currency': 'USD'},
      100000,
    ]) {
      test('ignores a limit that is not money in reais: $limit', () async {
        final failure = await failureFor(
          ProblemReply(422, 'LimitExceeded', {'limit': limit}),
        );

        expect((failure as ApiRejected).limitCents, isNull);
      });
    }

    test('treats an unknown code as unexpected, never guessing', () async {
      expect(
        await failureFor(const ProblemReply(422, 'SomethingNew')),
        isA<ApiUnexpected>(),
      );
    });

    test('treats a server error as unexpected', () async {
      expect(await failureFor(const JsonReply(500)), isA<ApiUnexpected>());
    });

    test('treats no answer as unreachable', () async {
      expect(await failureFor(const NetworkFailure()), isA<ApiUnreachable>());
    });

    // Found in the week 8 checkpoint: behind an interception proxy the app
    // refused the connection but said "Algo deu errado" (F-31).
    test('treats a refused certificate as unreachable (MOB-03)', () async {
      expect(await failureFor(const TlsFailure()), isA<ApiUnreachable>());
    });

    test('treats a body that is not a problem as unexpected', () async {
      expect(
        await failureFor(const JsonReply(422, {'message': 'nope'})),
        isA<ApiUnexpected>(),
      );
    });
  });
}
