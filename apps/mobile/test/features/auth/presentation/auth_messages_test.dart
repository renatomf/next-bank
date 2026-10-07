import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/session_end_reason.dart';
import 'package:next_bank/features/auth/presentation/auth_messages.dart';

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
    ]) {
      test(code.wire, () {
        expect(messageFor(ApiRejected(code)), message);
      });
    }

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
