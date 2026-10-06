import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/api_session_tokens.dart';
import 'package:next_bank/core/session/session_tokens.dart';
import 'package:next_bank/features/auth/domain/auth_repository.dart';
import 'package:nextbank_api/nextbank_api.dart';

/// [AuthRepository] over the generated API client (ADR 0008).
class HttpAuthRepository implements AuthRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final DefaultApi _api;

  @override
  Future<SessionTokens> register({
    required String name,
    required String email,
    required String cpf,
    required String password,
    required String? deviceLabel,
  }) => _call(() async {
    final response = await _api.registerCustomer(
      registerRequestInput: RegisterRequestInput(
        name: name,
        email: email,
        cpf: cpf,
        password: password,
        deviceLabel: deviceLabel,
      ),
    );
    return sessionTokensFrom(response.data!);
  });

  @override
  Future<SessionTokens> login({
    required String email,
    required String password,
    required String? deviceLabel,
  }) => _call(() async {
    final response = await _api.login(
      loginRequestInput: LoginRequestInput(
        email: email,
        password: password,
        deviceLabel: deviceLabel,
      ),
    );
    return sessionTokensFrom(response.data!);
  });

  @override
  Future<void> createPin(String pin) => _call(
    () =>
        _api.createPin(createPinRequestInput: CreatePinRequestInput(pin: pin)),
  );

  @override
  Future<void> logout() => _call(_api.logout);

  /// Every API error leaves the data layer as an [ApiFailure].
  Future<T> _call<T>(Future<T> Function() request) async {
    try {
      return await request();
    } on DioException catch (error) {
      throw apiFailureOf(error);
    }
  }
}
