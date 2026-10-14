import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/security/domain/active_session.dart';
import 'package:next_bank/features/security/domain/security_repository.dart';
import 'package:nextbank_api/nextbank_api.dart' as api;

/// [SecurityRepository] over the generated API client (ADR 0008). Secrets
/// go only in request bodies; a list with more than one current session,
/// which the server never sends, is refused (MASVS, code).
class HttpSecurityRepository implements SecurityRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final api.DefaultApi _api;

  @override
  Future<List<ActiveSession>> sessions() async {
    final list = await _call(_api.listMySessions);
    if (list == null) throw const ApiUnexpected();
    final sessions = [
      for (final session in list.items)
        ActiveSession(
          id: session.id,
          deviceLabel: session.deviceLabel,
          createdAt: session.createdAt,
          lastUsedAt: session.lastUsedAt,
          current: session.current,
        ),
    ];
    if (sessions.where((session) => session.current).length > 1) {
      throw const ApiUnexpected();
    }
    return sessions;
  }

  @override
  Future<void> verifyPin(String pin) => _call(
    () => _api.verifyPin(
      verifyPinRequestInput: api.VerifyPinRequestInput(pin: pin),
    ),
  );

  @override
  Future<void> revoke(String id) =>
      _call(() => _api.revokeMySession(sessionId: id));

  @override
  Future<void> changePin({required String password, required String newPin}) =>
      _call(
        () => _api.changePin(
          changePinRequestInput: api.ChangePinRequestInput(
            password: password,
            newPin: newPin,
          ),
        ),
      );

  @override
  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) => _call(
    () => _api.changePassword(
      changePasswordRequestInput: api.ChangePasswordRequestInput(
        currentPassword: currentPassword,
        newPassword: newPassword,
      ),
    ),
  );

  Future<T?> _call<T>(Future<Response<T>> Function() request) async {
    try {
      return (await request()).data;
    } on DioException catch (error) {
      throw apiFailureOf(error);
    }
  }
}
