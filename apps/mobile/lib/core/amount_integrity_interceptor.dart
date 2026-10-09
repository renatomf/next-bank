import 'package:dio/dio.dart';

/// Refuses an answer whose money is not integer cents (ADR 0006, D1).
///
/// The generated client reads every amount with `(v as num).toInt()`, so
/// 10.5 would silently become 10. The API never sends a fraction, but the
/// app checks what it receives (MASVS, code; finding F-18) and money is
/// never rounded quietly. The check walks the whole answer: a field named
/// `amount` is either the integer cents inside a `Money`, or a `Money` itself,
/// as a Pix or a statement item carries it, whose own `amount` is checked in
/// turn.
class AmountIntegrityInterceptor extends Interceptor {
  @override
  void onResponse(
    Response<dynamic> response,
    ResponseInterceptorHandler handler,
  ) {
    if (_hasInexactAmount(response.data)) {
      handler.reject(
        DioException(
          requestOptions: response.requestOptions,
          response: response,
          message: 'An amount is not integer cents',
        ),
      );
      return;
    }
    handler.next(response);
  }

  static bool _hasInexactAmount(Object? json) => switch (json) {
    Map<String, Object?>() => json.entries.any(
      (entry) =>
          (entry.key == 'amount' &&
              entry.value is! int &&
              entry.value is! Map) ||
          _hasInexactAmount(entry.value),
    ),
    List<Object?>() => json.any(_hasInexactAmount),
    _ => false,
  };
}
