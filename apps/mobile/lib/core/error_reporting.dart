import 'package:sentry_flutter/sentry_flutter.dart';

/// The same keys the API keeps out of its logs (API-04): never sent.
const Set<String> _sensitiveKeys = {
  'password',
  'currentpassword',
  'newpassword',
  'pin',
  'newpin',
  'cpf',
  // The number of a top-up (MOB-02).
  'phonenumber',
  'pixkey',
  'value',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'cookie',
  'email',
  'name',
};

// A CPF with or without its mask, as a customer would type it.
final RegExp _cpf = RegExp(r'\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b');

// A mobile number with or without its mask, as on a top-up: (11) 90000-0001.
final RegExp _phone = RegExp(r'\(?\b\d{2}\)?[\s-]?9\d{4}-?\d{4}\b');

/// Runs [app], reporting unexpected errors to Sentry only when the build
/// carries a DSN (`--dart-define=SENTRY_DSN=...`; week 8 plan, PR c).
/// Without it, as in debug and in tests, nothing leaves the phone.
Future<void> runWithErrorReporting(void Function() app) async {
  const dsn = String.fromEnvironment('SENTRY_DSN');
  if (dsn.isEmpty) return app();
  await SentryFlutter.init((options) {
    options
      ..dsn = dsn
      ..environment = const String.fromEnvironment(
        'APP_ENVIRONMENT',
        defaultValue: 'production',
      )
      // Errors only: no personal data, tracing, screenshots or replays.
      ..sendDefaultPii = false
      ..tracesSampleRate = 0
      ..beforeSend = ((event, _) => scrubEvent(event))
      ..beforeBreadcrumb = ((crumb, _) =>
          crumb == null ? null : scrubBreadcrumb(crumb));
  }, appRunner: app);
}

/// What leaves for Sentry (MOB-02): no user, only the address of a request,
/// and no CPF nor phone number in messages or exceptions. A pure function,
/// tested on its own.
SentryEvent scrubEvent(SentryEvent event) {
  event.user = null;
  final request = event.request;
  if (request != null) {
    event.request = SentryRequest(url: request.url, method: request.method);
  }
  final message = event.message;
  if (message != null) {
    event.message = SentryMessage(_maskPersonalNumbers(message.formatted));
  }
  for (final exception in event.exceptions ?? const <SentryException>[]) {
    final value = exception.value;
    if (value != null) exception.value = _maskPersonalNumbers(value);
  }
  event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb).toList();
  return event;
}

/// A breadcrumb without sensitive values, CPFs nor phone numbers.
Breadcrumb scrubBreadcrumb(Breadcrumb crumb) {
  final message = crumb.message;
  if (message != null) crumb.message = _maskPersonalNumbers(message);
  final data = crumb.data;
  if (data != null) {
    crumb.data = {
      for (final MapEntry(:key, :value) in data.entries)
        key: _sensitiveKeys.contains(key.toLowerCase())
            ? '[REDACTED]'
            : value is String
            ? _maskPersonalNumbers(value)
            : value,
    };
  }
  return crumb;
}

String _maskPersonalNumbers(String text) =>
    text.replaceAll(_cpf, '[CPF]').replaceAll(_phone, '[PHONE]');
