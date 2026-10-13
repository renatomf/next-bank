import 'dart:io';

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

  /// The signed-in customer's password did not match, changing the PIN or
  /// the password: 422, so the app stays signed in.
  passwordIncorrect('PasswordIncorrect'),

  /// Too many attempts: try again later.
  tooManyAttempts('TooManyAttempts'),

  /// A shared demo account cannot change its credentials or end sessions
  /// (DEMO-03): 403, so the app stays signed in.
  demoAccountRestricted('DemoAccountRestricted'),

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

  /// Wrong PIN; the answer says how many attempts are left.
  pinIncorrect('PinIncorrect'),

  /// Too many wrong PINs: locked for 30 minutes.
  pinLocked('PinLocked'),

  /// Locked too often: the PIN must be reset with the password.
  pinResetRequired('PinResetRequired'),

  /// The account has no PIN yet.
  pinNotCreated('PinNotCreated'),

  /// The resource does not exist for this customer.
  notFound('NotFound'),

  /// No Pix key with this value.
  pixKeyNotFound('PixKeyNotFound'),

  /// The key belongs to the payer's own account.
  samePayerAndPayee('SamePayerAndPayee'),

  /// Zero, negative or fractional amount.
  invalidAmount('InvalidAmount'),

  /// The available balance does not cover the amount.
  insufficientFunds('InsufficientFunds'),

  /// The amount is over the limit that applies now; the answer says which.
  limitExceeded('LimitExceeded'),

  /// The payer's account cannot send money.
  accountBlocked('AccountBlocked'),

  /// The 10 minutes to authorize the Pix are over.
  transferExpired('TransferExpired'),

  /// The Pix was already authorized, cancelled or expired.
  invalidTransferState('InvalidTransferState'),

  /// The same key came with a different request: a bug in the app.
  idempotencyKeyReused('IdempotencyKeyReused'),

  /// The same request is still running on the server.
  requestInProgress('RequestInProgress');

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
  const new(this.code, {this.remainingAttempts, this.limitCents});

  /// The catalog error the screen reacts to.
  final ApiErrorCode code;

  /// Attempts left after a wrong PIN, when the API says.
  final int? remainingAttempts;

  /// The limit an amount went over, in integer cents, when the API says.
  final int? limitCents;

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
      final remaining = body is Map ? body['remainingAttempts'] : null;
      for (final code in ApiErrorCode.values) {
        if (code.wire == wire) {
          return ApiRejected(
            code,
            remainingAttempts: remaining is int ? remaining : null,
            limitCents: body is Map ? _reaisCents(body['limit']) : null,
          );
        }
      }
      return const ApiUnexpected();
    // A refused certificate (MOB-03), as behind an interception proxy, leaves
    // no safe connection: the customer can only try another network. The
    // handshake failure of dart:io reaches Dio as unknown.
    case DioExceptionType.badCertificate:
      return const ApiUnreachable();
    case DioExceptionType.unknown when error.error is TlsException:
      return const ApiUnreachable();
    case DioExceptionType.cancel ||
        DioExceptionType.transformTimeout ||
        DioExceptionType.unknown:
      return const ApiUnexpected();
  }
}

// Money from the API is whole, non-negative cents in reais (F-18); anything
// else is dropped rather than shown.
int? _reaisCents(Object? money) => switch (money) {
  {'amount': final int cents, 'currency': 'BRL'} when cents >= 0 => cents,
  _ => null,
};
