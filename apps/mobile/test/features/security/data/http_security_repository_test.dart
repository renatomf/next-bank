import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/amount_integrity_interceptor.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/security/data/http_security_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

import '../../../support/scripted_server.dart';

const _phoneId = '0b9a7c1e-5d2f-4a8b-9c3d-7e6f5a4b3c2d';
const _laptopId = '7d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c4d';

HttpSecurityRepository repositoryFor(ScriptedServer server) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..httpClientAdapter = server
    // The app's own interceptors, as main.dart wires them (F-22).
    ..interceptors.add(AmountIntegrityInterceptor());
  return HttpSecurityRepository(
    NextbankApi(dio: dio, interceptors: []).getDefaultApi(),
  );
}

Map<String, Object?> activeSession(
  String id, {
  bool current = false,
  String? deviceLabel = 'Android',
}) => {
  'id': id,
  'deviceLabel': deviceLabel,
  'createdAt': '2026-10-09T10:00:00.000Z',
  'lastUsedAt': '2026-10-09T12:00:00.000Z',
  'current': current,
};

Object? jsonOf(Object? body) => body is String ? jsonDecode(body) : body;

Matcher rejectedWith(ApiErrorCode code) =>
    throwsA(isA<ApiRejected>().having((f) => f.code, 'code', code));

// The customer's sessions and the PIN and password changes (week 7 plan).
void main() {
  group('sessions', () {
    test('reads the active sessions, the current one marked', () async {
      final server = ScriptedServer({
        '/v1/me/sessions': (_) async => JsonReply(200, {
          'items': [
            activeSession(_phoneId, current: true),
            activeSession(_laptopId, deviceLabel: null),
          ],
        }),
      });

      final sessions = await repositoryFor(server).sessions();

      expect(server.received.single.method, 'GET');
      expect(sessions.map((s) => s.id), [_phoneId, _laptopId]);
      expect(sessions.first.current, isTrue);
      expect(sessions.first.deviceLabel, 'Android');
      expect(sessions.first.lastUsedAt, DateTime.utc(2026, 10, 9, 12));
      expect(sessions.last.deviceLabel, isNull);
    });

    // MASVS, code (F-18): only one session can be this device.
    test('refuses a list with more than one current session', () async {
      final server = ScriptedServer({
        '/v1/me/sessions': (_) async => JsonReply(200, {
          'items': [
            activeSession(_phoneId, current: true),
            activeSession(_laptopId, current: true),
          ],
        }),
      });

      await expectLater(
        repositoryFor(server).sessions(),
        throwsA(isA<ApiUnexpected>()),
      );
    });

    test('ends a session by its id', () async {
      final server = ScriptedServer({
        '/v1/me/sessions/$_laptopId/revoke': (_) async => const JsonReply(204),
      });

      await repositoryFor(server).revoke(_laptopId);

      expect(server.received.single.method, 'POST');
    });

    test('reports a session that is no longer there', () async {
      final server = ScriptedServer({
        '/v1/me/sessions/$_laptopId/revoke': (_) async =>
            const ProblemReply(404, 'NotFound'),
      });

      await expectLater(
        repositoryFor(server).revoke(_laptopId),
        rejectedWith(ApiErrorCode.notFound),
      );
    });
  });

  group('changePin', () {
    test('sends the password and the new PIN, only in the body', () async {
      final server = ScriptedServer({
        '/v1/me/pin/change': (_) async => const JsonReply(204),
      });

      await repositoryFor(server)
          .changePin(password: 'violet staple orbit 42', newPin: '1597');

      final request = server.received.single;
      expect(request.method, 'POST');
      expect(jsonOf(request.body), {
        'password': 'violet staple orbit 42',
        'newPin': '1597',
      });
    });

    test('reports a wrong password', () async {
      final server = ScriptedServer({
        '/v1/me/pin/change': (_) async =>
            const ProblemReply(422, 'PasswordIncorrect'),
      });

      await expectLater(
        repositoryFor(server).changePin(password: 'wrong', newPin: '1597'),
        rejectedWith(ApiErrorCode.passwordIncorrect),
      );
    });
  });

  group('changePassword', () {
    test('sends the current and the new password, only in the body', () async {
      final server = ScriptedServer({
        '/v1/me/password/change': (_) async => const JsonReply(204),
      });

      await repositoryFor(server).changePassword(
        currentPassword: 'violet staple orbit 42',
        newPassword: 'amber kettle ridge 77',
      );

      expect(jsonOf(server.received.single.body), {
        'currentPassword': 'violet staple orbit 42',
        'newPassword': 'amber kettle ridge 77',
      });
    });

    test('reports too many attempts', () async {
      final server = ScriptedServer({
        '/v1/me/password/change': (_) async =>
            const ProblemReply(429, 'TooManyAttempts'),
      });

      await expectLater(
        repositoryFor(server).changePassword(
          currentPassword: 'wrong',
          newPassword: 'amber kettle ridge 77',
        ),
        rejectedWith(ApiErrorCode.tooManyAttempts),
      );
    });
  });
}
