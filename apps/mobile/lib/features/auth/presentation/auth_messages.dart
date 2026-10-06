import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/session_end_reason.dart';

/// The text shown for a failed call (catalog, domain-model.md section 9).
String messageFor(ApiFailure failure) => switch (failure) {
  ApiRejected(:final code) => _catalogText(code),
  ApiUnreachable() => 'Sem conexão. Tente de novo.',
  ApiUnexpected() => 'Algo deu errado. Tente de novo.',
};

/// Why the user is back on the login screen.
String sessionEndMessage(SessionEndReason reason) => switch (reason) {
  SessionEndReason.expired => _catalogText(ApiErrorCode.sessionExpired),
  SessionEndReason.revoked => _catalogText(
    ApiErrorCode.refreshTokenReuseDetected,
  ),
};

// Exhaustive: a code added to the catalog cannot ship without its text.
String _catalogText(ApiErrorCode code) => switch (code) {
  ApiErrorCode.invalidRequest => 'Confira os dados informados.',
  ApiErrorCode.invalidCpf => 'CPF inválido.',
  ApiErrorCode.weakPassword =>
    'Use pelo menos 10 caracteres e evite senhas comuns.',
  ApiErrorCode.alreadyRegistered =>
    'Não foi possível concluir o cadastro com esses dados.',
  ApiErrorCode.invalidCredentials => 'E-mail ou senha incorretos.',
  ApiErrorCode.tooManyAttempts =>
    'Muitas tentativas. Tente de novo em alguns minutos.',
  ApiErrorCode.unauthenticated => 'Faça login para continuar.',
  ApiErrorCode.sessionExpired => 'Sua sessão expirou.',
  ApiErrorCode.refreshTokenReuseDetected => 'Por segurança, entre novamente.',
  ApiErrorCode.invalidPin =>
    'Use 4 dígitos que não sejam repetidos nem em sequência.',
  ApiErrorCode.pinAlreadyCreated =>
    'Você já tem um PIN. Para trocar, use Perfil > Segurança.',
};
