import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/error_reporting.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

// What the app sends to Sentry carries no personal data nor secrets
// (CLAUDE.md, LGPD; MOB-02; week 8 plan, PR c).
void main() {
  group('scrubEvent', () {
    test('drops the user and keeps only the address of a request', () {
      final event = scrubEvent(
        SentryEvent(
          user: SentryUser(id: 'u-1', email: 'ana@example.com'),
          request: SentryRequest(
            url: 'https://api.example/v1/auth/login',
            method: 'POST',
            data: {'password': 'p'},
            headers: {'Authorization': 'Bearer abc'},
            cookies: 'a=b',
            queryString: 'cursor=abc',
          ),
        ),
      );

      expect(event.user, isNull);
      expect(event.request?.url, 'https://api.example/v1/auth/login');
      expect(event.request?.method, 'POST');
      expect(event.request?.data, isNull);
      expect(event.request?.headers, isEmpty);
      expect(event.request?.cookies, isNull);
      expect(event.request?.queryString, isNull);
    });

    test('masks anything shaped like a CPF in messages and exceptions', () {
      final event = scrubEvent(
        SentryEvent(
          message: SentryMessage('lookup of 529.982.247-25 failed'),
          exceptions: [
            SentryException(type: 'StateError', value: 'cpf 52998224725 busy'),
          ],
        ),
      );

      expect(event.message?.formatted, 'lookup of [CPF] failed');
      expect(event.exceptions?.single.value, 'cpf [CPF] busy');
    });
  });

  group('scrubBreadcrumb', () {
    test('redacts sensitive keys and CPFs, keeping the rest', () {
      final crumb = scrubBreadcrumb(
        Breadcrumb(
          message: 'typed 52998224725',
          data: {
            'password': 'p',
            'pin': '2580',
            'refreshToken': 'r',
            'status': 401,
          },
        ),
      );

      expect(crumb.message, 'typed [CPF]');
      expect(crumb.data, {
        'password': '[REDACTED]',
        'pin': '[REDACTED]',
        'refreshToken': '[REDACTED]',
        'status': 401,
      });
    });
  });
}
