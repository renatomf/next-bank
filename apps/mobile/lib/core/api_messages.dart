import 'package:design_system/design_system.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/session_end_reason.dart';

/// The text shown for a failed call (catalog, domain-model.md section 9).
String messageFor(ApiFailure failure) => switch (failure) {
  ApiRejected(code: ApiErrorCode.pinIncorrect, :final remainingAttempts?) =>
    _attemptsLeft(remainingAttempts),
  // The server knows which limit applies now (PIX-10): the text names it.
  ApiRejected(code: ApiErrorCode.limitExceeded, :final limitCents?) =>
    'Valor acima do seu limite de ${formatReais(limitCents).full} por Pix.',
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
  ApiErrorCode.passwordIncorrect => 'Senha incorreta.',
  ApiErrorCode.demoAccountRestricted =>
    'Esta é uma conta de demonstração. Para testar essa função, crie sua '
        'própria conta.',
  ApiErrorCode.tooManyAttempts =>
    'Muitas tentativas. Tente de novo em alguns minutos.',
  ApiErrorCode.unauthenticated => 'Faça login para continuar.',
  ApiErrorCode.sessionExpired => 'Sua sessão expirou.',
  ApiErrorCode.refreshTokenReuseDetected => 'Por segurança, entre novamente.',
  ApiErrorCode.invalidPin =>
    'Use 4 dígitos que não sejam repetidos nem em sequência.',
  ApiErrorCode.pinAlreadyCreated =>
    'Você já tem um PIN. Para trocar, use Perfil > Segurança.',
  ApiErrorCode.pinIncorrect => 'PIN incorreto.',
  ApiErrorCode.pinLocked => 'PIN bloqueado por 30 minutos.',
  ApiErrorCode.pinResetRequired =>
    'PIN bloqueado por segurança. Redefina o PIN com sua senha em '
        'Perfil > Segurança.',
  ApiErrorCode.pinNotCreated => 'Crie seu PIN para continuar.',
  ApiErrorCode.notFound => 'Não encontrado.',
  ApiErrorCode.pixKeyNotFound => 'Não encontramos essa chave Pix.',
  ApiErrorCode.samePayerAndPayee =>
    'Você não pode enviar Pix para a própria conta.',
  ApiErrorCode.invalidAmount => 'Informe um valor válido.',
  ApiErrorCode.insufficientFunds => 'Saldo insuficiente.',
  ApiErrorCode.limitExceeded => 'Valor acima do seu limite.',
  ApiErrorCode.accountBlocked =>
    'Sua conta está bloqueada. Fale com o suporte.',
  ApiErrorCode.transferExpired =>
    'O tempo para confirmar acabou. Comece de novo.',
  ApiErrorCode.invalidTransferState => 'Este Pix já foi processado.',
  ApiErrorCode.idempotencyKeyReused => 'Algo deu errado. Tente de novo.',
  ApiErrorCode.requestInProgress =>
    'Ainda estamos processando. Tente de novo em instantes.',
};

String _attemptsLeft(int remaining) => remaining == 1
    ? 'PIN incorreto. Resta 1 tentativa.'
    : 'PIN incorreto. Restam $remaining tentativas.';
