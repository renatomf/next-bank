import 'package:flutter/foundation.dart';

/// Hosts reachable over plain HTTP, and only in debug builds (MOB-03).
const _localHosts = {'10.0.2.2', 'localhost', '127.0.0.1'};

/// Set at build time with `--dart-define=API_BASE_URL=...`.
/// Defaults to the host machine as seen from the Android emulator.
const _apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

/// API base URL for this build.
/// A release build without an HTTPS URL fails at startup.
final Uri apiBaseUrl = validateApiBaseUrl(_apiBaseUrl, isRelease: kReleaseMode);

/// Accepts HTTPS anywhere and plain HTTP only to local hosts in debug (MOB-03).
Uri validateApiBaseUrl(String url, {required bool isRelease}) {
  final uri = Uri.tryParse(url);
  if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
    throw ArgumentError.value(url, 'url', 'must be an absolute URL');
  }
  if (uri.scheme == 'https') return uri;
  if (uri.scheme == 'http' && !isRelease && _localHosts.contains(uri.host)) {
    return uri;
  }
  throw ArgumentError.value(
    url,
    'url',
    'must use HTTPS (plain HTTP only to local hosts in debug)',
  );
}
