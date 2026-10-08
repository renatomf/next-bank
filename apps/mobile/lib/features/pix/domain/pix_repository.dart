import 'package:next_bank/features/pix/domain/pix_transfer.dart';

/// Sends Pix through the API. Failures are reported as `ApiFailure` with the
/// catalog code. Every command takes the idempotency key of its attempt, so a
/// repeated attempt never becomes a second Pix (ADR 0007; MOB-07).
abstract interface class PixRepository {
  /// Who holds the CPF key [cpf] (11 digits).
  Future<PixPayee> lookup(String cpf);

  /// Creates a Pix of [amountCents] to the CPF key [cpf], waiting for the PIN.
  Future<PixTransfer> create({
    required String cpf,
    required int amountCents,
    required String? description,
    required String idempotencyKey,
  });

  /// The Pix [transferId] as the server has it now.
  Future<PixTransfer> fetch(String transferId);

  /// Authorizes the Pix [transferId] with the [pin], checked on the server.
  Future<PixTransfer> authorize({
    required String transferId,
    required String pin,
    required String idempotencyKey,
  });
}
