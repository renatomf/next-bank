import 'package:dio/dio.dart';
import 'package:next_bank/core/session/session_tokens.dart';

/// Marks a call already repeated after a refresh, so a second 401 just fails.
const String _repeated = 'session-repeated';

/// Sends the access token on protected calls and, when it has expired,
/// renews the session once and repeats the call (ADR 0004).
///
/// Simultaneous 401s share a single refresh ("single flight"): spending the
/// same refresh token twice could look like reuse to the server and revoke
/// the user's own session (AUTH-03).
class SessionInterceptor extends Interceptor {
  /// Creates the interceptor for `dio`, which it also uses to repeat calls.
  /// `refresh` must use a client without this interceptor.
  new({
    required this._dio,
    required this._currentTokens,
    required this._refresh,
    required this._onRefreshed,
    required this._onSessionEnded,
  });

  final Dio _dio;
  final SessionTokens? Function() _currentTokens;
  final Future<SessionTokens> Function(String refreshToken) _refresh;
  final Future<void> Function(SessionTokens tokens) _onRefreshed;
  final Future<void> Function() _onSessionEnded;

  /// The refresh in progress, shared by every call waiting for it.
  Future<SessionTokens?>? _refreshing;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final tokens = _currentTokens();
    // Only where the contract asks for it: public calls never carry a token.
    if (tokens != null && _isProtected(options)) {
      options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final error = err;
    final options = error.requestOptions;
    final eligible =
        error.response?.statusCode == 401 &&
        _isProtected(options) &&
        options.extra[_repeated] != true;
    if (!eligible) return handler.next(error);

    final SessionTokens? fresh;
    try {
      fresh = await _renewedTokensFor(options);
    } on DioException catch (refreshError) {
      return handler.next(refreshError);
    }
    if (fresh == null) return handler.next(error);

    options.extra[_repeated] = true;
    try {
      handler.resolve(await _dio.fetch<dynamic>(options));
    } on DioException catch (repeatError) {
      handler.next(repeatError);
    }
  }

  /// The tokens to repeat the call with: the current ones if another call
  /// already renewed them, otherwise the result of the shared refresh.
  Future<SessionTokens?> _renewedTokensFor(RequestOptions options) {
    final current = _currentTokens();
    final sentWith = options.headers['Authorization'];
    if (current != null && sentWith != 'Bearer ${current.accessToken}') {
      return Future.value(current);
    }
    return _refreshing ??= _refreshOnce().whenComplete(
      () => _refreshing = null,
    );
  }

  Future<SessionTokens?> _refreshOnce() async {
    final tokens = _currentTokens();
    if (tokens == null) return null;
    final SessionTokens fresh;
    try {
      fresh = await _refresh(tokens.refreshToken);
    } on DioException catch (error) {
      // Refused (expired, revoked, reuse): the session is over. A network
      // failure keeps it: being offline must not log the user out.
      if (error.response?.statusCode == 401) await _onSessionEnded();
      rethrow;
    }
    // Signed out while the refresh was running: never sign back in.
    if (_currentTokens() == null) return null;
    await _onRefreshed(fresh);
    return fresh;
  }

  /// Calls the generated client marks with the bearerAuth security scheme.
  static bool _isProtected(RequestOptions options) {
    final schemes = options.extra['secure'];
    return schemes is List &&
        schemes.any(
          (scheme) => scheme is Map && scheme['name'] == 'bearerAuth',
        );
  }
}
