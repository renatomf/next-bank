import 'package:next_bank/features/top_up/domain/top_up.dart';

/// Phone top-ups through the API. Failures are reported as `ApiFailure` with
/// the catalog code. A top-up takes the idempotency key of its attempt, so a
/// repeated attempt never becomes a second top-up (ADR 0007; MOB-07).
abstract interface class TopUpRepository {
  /// The operators and the amounts each offers.
  Future<List<TopUpOperator>> operators();

  /// Tops up [phoneDigits] with [amountCents] through [operatorId], the
  /// [pin] checked on the server.
  Future<TopUp> create({
    required String operatorId,
    required String phoneDigits,
    required int amountCents,
    required String pin,
    required String idempotencyKey,
  });

  /// The receipt of the top-up [topUpId].
  Future<TopUp> fetch(String topUpId);
}
