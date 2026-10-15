import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/domain/receiving_key.dart';

/// Sends Pix through the API. Failures are reported as `ApiFailure` with the
/// catalog code. Every command takes the idempotency key of its attempt, so a
/// repeated attempt never becomes a second Pix (ADR 0007; MOB-07).
abstract interface class PixRepository {
  /// Who holds the [key].
  Future<PixPayee> lookup(PixKeyRef key);

  /// Creates a Pix of [amountCents] to the [key], waiting for the PIN.
  Future<PixTransfer> create({
    required PixKeyRef key,
    required int amountCents,
    required String? description,
    required String idempotencyKey,
  });

  /// The Pix [transferId] as the server has it now.
  Future<PixTransfer> fetch(String transferId);

  /// The customer's random key to receive by QR Code, created by the server
  /// the first time.
  Future<ReceivingKey> receivingKey();

  /// Authorizes the Pix [transferId] with the [pin], checked on the server.
  Future<PixTransfer> authorize({
    required String transferId,
    required String pin,
    required String idempotencyKey,
  });
}
