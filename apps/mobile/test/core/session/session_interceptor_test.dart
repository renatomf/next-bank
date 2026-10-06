import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/api_session_tokens.dart';
import 'package:next_bank/core/session/session_interceptor.dart';
import 'package:next_bank/core/session/session_tokens.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../support/scripted_server.dart';

// Access token on protected calls, and one refresh at a time when it expires
// (ADR 0004; AUTH-03 and AUTH-06 on the app side).
final SessionTokens oldTokens = SessionTokens(
  accessToken: 'old-access',
  accessTokenExpiresAt: DateTime.utc(2026, 10, 6, 12),
  refreshToken: 'old-refresh',
);

/// The app's session and its two APIs: one with the interceptor, one
/// without it for the refresh itself.
class Harness {
  new({
    required Future<Reply> Function(RequestOptions) pin,
    required Future<Reply> Function(RequestOptions) refresh,
  }) {
    api = ScriptedServer({
      '/v1/me/pin': pin,
      '/v1/auth/login': (_) async =>
          JsonReply(200, authTokens('login-access', 'login-refresh')),
    });
    auth = ScriptedServer({'/v1/auth/refresh': refresh});
    final refreshApi = NextbankApi(
      dio: Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..httpClientAdapter = auth,
      interceptors: [],
    ).getDefaultApi();
    final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..httpClientAdapter = api;
    dio.interceptors.add(
      SessionInterceptor(
        dio: dio,
        currentTokens: () => tokens,
        refresh: (refreshToken) async => sessionTokensFrom(
          (await refreshApi.refreshSession(
            refreshRequestInput: RefreshRequestInput(
              refreshToken: refreshToken,
            ),
          )).data!,
        ),
        onRefreshed: (fresh) async => tokens = fresh,
        onSessionEnded: () async {
          ended++;
          tokens = null;
        },
      ),
    );
    client = NextbankApi(dio: dio, interceptors: []).getDefaultApi();
  }

  late final ScriptedServer api;
  late final ScriptedServer auth;
  late final DefaultApi client;
  SessionTokens? tokens = oldTokens;
  int ended = 0;

  Future<void> createPin() => client.createPin(
    createPinRequestInput: CreatePinRequestInput(pin: '2580'),
  );

  Object? authorizationOf(int index) =>
      api.received[index].headers['Authorization'];
}

/// The protected endpoint: accepts only the given access token.
Future<Reply> Function(RequestOptions) acceptOnly(String accessToken) =>
    (request) async => request.headers['Authorization'] == 'Bearer $accessToken'
    ? const JsonReply(204)
    : const ProblemReply(401, 'Unauthenticated');

Future<Reply> Function(RequestOptions) refreshTo(String accessToken) =>
    (_) async => JsonReply(200, authTokens(accessToken, 'new-refresh'));

Future<ApiFailure> failureOf(Future<void> call) async {
  try {
    await call;
  } on DioException catch (error) {
    return apiFailureOf(error);
  }
  fail('the call should have failed');
}

void main() {
  group('SessionInterceptor', () {
    test('sends the access token on protected calls', () async {
      final harness = Harness(
        pin: acceptOnly('old-access'),
        refresh: refreshTo('unused'),
      );

      await harness.createPin();

      expect(harness.authorizationOf(0), 'Bearer old-access');
    });

    test('never sends it on public calls, even with a session', () async {
      final harness = Harness(
        pin: acceptOnly('old-access'),
        refresh: refreshTo('unused'),
      );

      await harness.client.login(
        loginRequestInput: LoginRequestInput(email: 'a@b.test', password: 'p'),
      );

      expect(harness.authorizationOf(0), isNull);
    });

    test(
      'refreshes once on 401 and repeats the call with the new token',
      () async {
        final harness = Harness(
          pin: acceptOnly('new-access'),
          refresh: refreshTo('new-access'),
        );

        await harness.createPin();

        expect(harness.auth.callsTo('/v1/auth/refresh'), 1);
        expect(harness.authorizationOf(1), 'Bearer new-access');
        expect(harness.tokens?.refreshToken, 'new-refresh');
      },
    );

    test('sends the refresh token it holds, nothing else', () async {
      final harness = Harness(
        pin: acceptOnly('new-access'),
        refresh: refreshTo('new-access'),
      );

      await harness.createPin();

      final body = harness.auth.received.single.body.toString();
      expect(body, contains('old-refresh'));
      expect(harness.auth.received.single.headers['Authorization'], isNull);
    });

    test('lets simultaneous 401s share one refresh (single flight)', () async {
      final gate = Completer<void>();
      final harness = Harness(
        pin: acceptOnly('new-access'),
        refresh: (_) async {
          await gate.future;
          return JsonReply(200, authTokens('new-access', 'new-refresh'));
        },
      );

      final calls = [
        harness.createPin(),
        harness.createPin(),
        harness.createPin(),
      ];
      await Future<void>.delayed(const Duration(milliseconds: 50));
      gate.complete();
      await Future.wait(calls);

      // Spending the refresh token three times could look like reuse to the
      // server and revoke the user's own session (AUTH-03).
      expect(harness.auth.callsTo('/v1/auth/refresh'), 1);
      expect(harness.api.callsTo('/v1/me/pin'), 6);
    });

    test(
      'skips the refresh when another call already renewed the token',
      () async {
        final harness = Harness(
          pin: acceptOnly('new-access'),
          refresh: refreshTo('new-access'),
        );
        await harness.createPin();

        // A call sent with the old token answers 401 after the renewal.
        harness.tokens = SessionTokens(
          accessToken: 'new-access',
          accessTokenExpiresAt: DateTime.utc(2026, 10, 6, 12, 15),
          refreshToken: 'new-refresh',
        );
        await harness.createPin();

        expect(harness.auth.callsTo('/v1/auth/refresh'), 1);
      },
    );

    for (final code in ['SessionExpired', 'RefreshTokenReuseDetected']) {
      test('ends the session when the refresh is refused ($code)', () async {
        final harness = Harness(
          pin: acceptOnly('new-access'),
          refresh: (_) async => ProblemReply(401, code),
        );

        final failure = await failureOf(harness.createPin());

        expect(harness.ended, 1);
        expect(harness.tokens, isNull);
        expect(failure, isA<ApiRejected>());
      });
    }

    test('keeps the session when the refresh cannot reach the API', () async {
      final harness = Harness(
        pin: acceptOnly('new-access'),
        refresh: (_) async => const NetworkFailure(),
      );

      final failure = await failureOf(harness.createPin());

      expect(failure, isA<ApiUnreachable>());
      expect(harness.ended, 0);
      expect(harness.tokens, same(oldTokens));
    });

    test(
      'does not loop: a repeated call answered 401 again just fails',
      () async {
        final harness = Harness(
          pin: acceptOnly('never-valid'),
          refresh: refreshTo('new-access'),
        );

        final failure = await failureOf(harness.createPin());

        expect(harness.auth.callsTo('/v1/auth/refresh'), 1);
        expect(harness.api.callsTo('/v1/me/pin'), 2);
        expect(failure, isA<ApiRejected>());
      },
    );

    test(
      'discards a refresh that finishes after the user signed out',
      () async {
        final gate = Completer<void>();
        final harness = Harness(
          pin: acceptOnly('new-access'),
          refresh: (_) async {
            await gate.future;
            return JsonReply(200, authTokens('new-access', 'new-refresh'));
          },
        );

        final call = failureOf(harness.createPin());
        await Future<void>.delayed(const Duration(milliseconds: 50));
        harness.tokens = null; // signed out while the refresh was running
        gate.complete();
        await call;

        expect(harness.tokens, isNull);
      },
    );
  });
}
