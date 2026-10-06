import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_config.dart';

void main() {
  group('validateApiBaseUrl (MOB-03)', () {
    test('accepts HTTPS in release', () {
      expect(
        validateApiBaseUrl('https://api.example.com', isRelease: true),
        Uri.parse('https://api.example.com'),
      );
    });

    test('rejects plain HTTP in release', () {
      expect(
        () => validateApiBaseUrl('http://api.example.com', isRelease: true),
        throwsArgumentError,
      );
    });

    test('rejects plain HTTP to the emulator host in release', () {
      expect(
        () => validateApiBaseUrl('http://10.0.2.2:3000', isRelease: true),
        throwsArgumentError,
      );
    });

    test('accepts plain HTTP only to local hosts in debug', () {
      for (final url in [
        'http://10.0.2.2:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ]) {
        expect(validateApiBaseUrl(url, isRelease: false).toString(), url);
      }
    });

    test('rejects plain HTTP to remote hosts in debug', () {
      expect(
        () => validateApiBaseUrl('http://api.example.com', isRelease: false),
        throwsArgumentError,
      );
    });

    test('rejects a malformed URL', () {
      expect(
        () => validateApiBaseUrl('not a url', isRelease: false),
        throwsArgumentError,
      );
    });
  });
}
