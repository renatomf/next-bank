import 'dart:math';

import 'package:dio/dio.dart';

/// Gives every request an `x-request-id`, so one id follows it from the app
/// to the API and database logs (CLAUDE.md, section 7). 128 random bits in
/// hex: within what the API accepts ([A-Za-z0-9-]{8,64}).
class RequestIdInterceptor extends Interceptor {
  final Random _random = Random.secure();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers['x-request-id'] = _newId();
    handler.next(options);
  }

  String _newId() => List.generate(
    16,
    (_) => _random.nextInt(256).toRadixString(16).padLeft(2, '0'),
  ).join();
}
