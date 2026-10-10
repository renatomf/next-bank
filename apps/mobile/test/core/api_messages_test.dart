import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/session/session_end_reason.dart';

// The texts of the error catalog (domain-model.md, section 9).
void main() {
  group('messageFor', () {
    for (final (code, message) in [
      (ApiErrorCode.invalidRequest, 'Confira os dados informados.'),
      (ApiErrorCode.invalidCpf, 'CPF inválido.'),
      (
        ApiErrorCode.weakPassword,
        'Use pelo menos 10 caracteres e evite senhas comuns.',
      ),
      // Deliberately vague: never tells which datum has an account (AUTH-02).
      (
        ApiErrorCode.alreadyRegistered,
        'Não foi possível concluir o cadastro com esses dados.',
      ),
      // Same text for an unknown e-mail and a wrong password (AUTH-02).
      (ApiErrorCode.invalidCredentials, 'E-mail ou senha incorretos.'),
      (
        ApiErrorCode.tooManyAttempts,
        'Muitas tentativas. Tente de novo em alguns minutos.',
      ),
      (ApiErrorCode.unauthenticated, 'Faça login para continuar.'),
      (ApiErrorCode.sessionExpired, 'Sua sessão expirou.'),
      (
        ApiErrorCode.refreshTokenReuseDetected,
        'Por segurança, entre novamente.',
      ),
      (
        ApiErrorCode.invalidPin,
        'Use 4 dígitos que não sejam repetidos nem em sequência.',
      ),
      (
        ApiErrorCode.pinAlreadyCreated,
        'Você já tem um PIN. Para trocar, use Perfil > Segurança.',
      ),
      (ApiErrorCode.notFound, 'Não encontrado.'),
      (ApiErrorCode.passwordIncorrect, 'Senha incorreta.'),
      (ApiErrorCode.pixKeyNotFound, 'Não encontramos essa chave Pix.'),
      (
        ApiErrorCode.samePayerAndPayee,
        'Você não pode enviar Pix para a própria conta.',
      ),
      (ApiErrorCode.invalidAmount, 'Informe um valor válido.'),
      (ApiErrorCode.insufficientFunds, 'Saldo insuficiente.'),
      (ApiErrorCode.limitExceeded, 'Valor acima do seu limite.'),
      (
        ApiErrorCode.accountBlocked,
        'Sua conta está bloqueada. Fale com o suporte.',
      ),
      (
        ApiErrorCode.transferExpired,
        'O tempo para confirmar acabou. Comece de novo.',
      ),
      (ApiErrorCode.invalidTransferState, 'Este Pix já foi processado.'),
      // A bug in the app, never the customer's doing.
      (ApiErrorCode.idempotencyKeyReused, 'Algo deu errado. Tente de novo.'),
      (
        ApiErrorCode.requestInProgress,
        'Ainda estamos processando. Tente de novo em instantes.',
      ),
    ]) {
      test(code.wire, () {
        expect(messageFor(ApiRejected(code)), message);
      });
    }

    test('a wrong PIN says how many attempts are left', () {
      expect(
        messageFor(
          const ApiRejected(ApiErrorCode.pinIncorrect, remainingAttempts: 3),
        ),
        'PIN incorreto. Restam 3 tentativas.',
      );
      expect(
        messageFor(
          const ApiRejected(ApiErrorCode.pinIncorrect, remainingAttempts: 1),
        ),
        'PIN incorreto. Resta 1 tentativa.',
      );
    });

    // The server knows which limit applies now (PIX-10); the app only says it.
    test('an amount over the limit says the limit', () {
      expect(
        messageFor(
          const ApiRejected(ApiErrorCode.limitExceeded, limitCents: 100000),
        ),
        r'Valor acima do seu limite de R$ 1.000,00 por Pix.',
      );
    });

    test('no answer from the API', () {
      expect(messageFor(const ApiUnreachable()), 'Sem conexão. Tente de novo.');
    });

    test('an answer the app cannot interpret', () {
      expect(
        messageFor(const ApiUnexpected()),
        'Algo deu errado. Tente de novo.',
      );
    });
  });

  group('sessionEndMessage', () {
    test('an expired session', () {
      expect(
        sessionEndMessage(SessionEndReason.expired),
        'Sua sessão expirou.',
      );
    });

    test('a session revoked after a detected reuse (AUTH-03)', () {
      expect(
        sessionEndMessage(SessionEndReason.revoked),
        'Por segurança, entre novamente.',
      );
    });
  });
}
