import 'package:dio/dio.dart';

/// Refuses an answer whose money is not integer cents (ADR 0006, D1).
///
/// The generated client reads every amount with `(v as num).toInt()`, so
/// 10.5 would silently become 10. The API never sends a fraction, but the
/// app checks what it receives (MASVS, code; finding F-18) and money is
/// never rounded quietly. Every `amount` in the contract is a `Money`, so
/// the check walks the whole answer.
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
          (entry.key == 'amount' && entry.value is! int) ||
          _hasInexactAmount(entry.value),
    ),
    List<Object?>() => json.any(_hasInexactAmount),
    _ => false,
  };
}
