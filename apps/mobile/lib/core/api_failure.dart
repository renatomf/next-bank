import 'package:dio/dio.dart';

/// Error codes of the API catalog (domain-model.md, section 9) the app knows.
/// A new code reaches the app as [ApiUnexpected] until it is added here.
enum ApiErrorCode {
  /// Input out of format or with an unknown field.
  invalidRequest('InvalidRequest'),

  /// CPF with wrong check digits.
  invalidCpf('InvalidCpf'),

  /// Password shorter than 10 characters or too common.
  weakPassword('WeakPassword'),

  /// E-mail or CPF already has an account (deliberately vague).
  alreadyRegistered('AlreadyRegistered'),

  /// Wrong e-mail or password (same answer for both).
  invalidCredentials('InvalidCredentials'),

  /// Too many attempts: try again later.
  tooManyAttempts('TooManyAttempts'),

  /// Missing, invalid or expired access token.
  unauthenticated('Unauthenticated'),

  /// The session ended: log in again.
  sessionExpired('SessionExpired'),

  /// A replaced refresh token came back: the session was revoked.
  refreshTokenReuseDetected('RefreshTokenReuseDetected'),

  /// PIN with a trivial pattern or not 4 digits.
  invalidPin('InvalidPin'),

  /// The PIN exists; changing it needs the password.
  pinAlreadyCreated('PinAlreadyCreated'),

  /// The resource does not exist for this customer.
  notFound('NotFound');

  new(this.wire);

  /// The code as the API sends it.
  final String wire;
}

/// Why a call to the API failed.
sealed class ApiFailure implements Exception {
  const new();
}

/// The API refused the request with a catalog error.
final class ApiRejected extends ApiFailure {
  /// Creates a refusal with its catalog code.
  const new(this.code);

  /// The catalog error the screen reacts to.
  final ApiErrorCode code;

  @override
  String toString() => 'ApiRejected(${code.wire})';
}

/// No answer from the API (no connection, timeout).
final class ApiUnreachable extends ApiFailure {
  /// Creates the failure.
  const new();
}

/// An answer the app cannot interpret: server error or unknown code.
final class ApiUnexpected extends ApiFailure {
  /// Creates the failure.
  const new();
}

/// Turns what Dio reports into the failure the app reacts to. Never guesses:
/// anything outside the catalog is [ApiUnexpected].
ApiFailure apiFailureOf(DioException error) {
  switch (error.type) {
    case DioExceptionType.connectionError ||
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout:
      return const ApiUnreachable();
    case DioExceptionType.badResponse:
      final body = error.response?.data;
      final wire = body is Map ? body['code'] : null;
      for (final code in ApiErrorCode.values) {
        if (code.wire == wire) return ApiRejected(code);
      }
      return const ApiUnexpected();
    case DioExceptionType.badCertificate ||
        DioExceptionType.cancel ||
        DioExceptionType.transformTimeout ||
        DioExceptionType.unknown:
      return const ApiUnexpected();
  }
}
