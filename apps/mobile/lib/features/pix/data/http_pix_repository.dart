import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_money.dart';
import 'package:next_bank/features/pix/data/api_pix_key.dart';
import 'package:next_bank/features/pix/domain/pix_repository.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/domain/receiving_key.dart';
import 'package:nextbank_api/nextbank_api.dart' as api;

/// [PixRepository] over the generated API client (ADR 0008). The client
/// refuses an unknown status, reason or key type; what it lets through that
/// the server never sends, such as a non-positive amount or a failed Pix
/// without a reason, is refused here (MASVS, code).
class HttpPixRepository implements PixRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final api.DefaultApi _api;

  @override
  Future<PixPayee> lookup(PixKeyRef key) async {
    final found = await _call(
      () => _api.lookupPixKey(
        pixKeyLookupRequestInput: api.PixKeyLookupRequestInput(
          type: switch (key.type) {
            PixKeyType.cpf => api.PixKeyLookupRequestInputTypeEnum.CPF,
            PixKeyType.email => api.PixKeyLookupRequestInputTypeEnum.EMAIL,
            PixKeyType.phone => api.PixKeyLookupRequestInputTypeEnum.PHONE,
            PixKeyType.random => api.PixKeyLookupRequestInputTypeEnum.RANDOM,
          },
          value: key.value,
        ),
      ),
    );
    return PixPayee(
      name: found.payeeName,
      documentMasked: found.payeeDocumentMasked,
      keyType: switch (found.keyType) {
        api.PixKeyLookupKeyTypeEnum.CPF => PixKeyType.cpf,
        api.PixKeyLookupKeyTypeEnum.EMAIL => PixKeyType.email,
        api.PixKeyLookupKeyTypeEnum.PHONE => PixKeyType.phone,
        api.PixKeyLookupKeyTypeEnum.RANDOM => PixKeyType.random,
        api.PixKeyLookupKeyTypeEnum.unknownDefaultOpenApi =>
          throw const ApiUnexpected(),
      },
      keyMasked: found.keyMasked,
      bankName: found.bank?.name,
    );
  }

  @override
  Future<PixTransfer> create({
    required PixKeyRef key,
    required int amountCents,
    required String? description,
    required String idempotencyKey,
  }) async => _transferOf(
    await _call(
      () => _api.createPixTransfer(
        idempotencyKey: idempotencyKey,
        createPixTransferRequestInput: api.CreatePixTransferRequestInput(
          key: pixKeyRequestOf(key),
          amount: api.MoneyInput(
            amount: amountCents,
            currency: api.MoneyInputCurrencyEnum.BRL,
          ),
          description: description,
        ),
      ),
    ),
  );

  @override
  Future<PixTransfer> fetch(String transferId) async => _transferOf(
    await _call(() => _api.getPixTransfer(transferId: transferId)),
  );

  @override
  Future<ReceivingKey> receivingKey() async {
    final found = await _call(_api.getReceivingKey);
    // Only a random key may reach a QR Code, whatever the answer says (PIX-12).
    if (!isRandomPixKey(found.key)) throw const ApiUnexpected();
    return ReceivingKey(key: found.key, keyMasked: found.keyMasked);
  }

  @override
  Future<PixTransfer> authorize({
    required String transferId,
    required String pin,
    required String idempotencyKey,
  }) async => _transferOf(
    await _call(
      () => _api.authorizePixTransfer(
        transferId: transferId,
        idempotencyKey: idempotencyKey,
        authorizePixTransferRequestInput: api.AuthorizePixTransferRequestInput(
          pin: pin,
        ),
      ),
    ),
  );

  Future<T> _call<T>(Future<Response<T>> Function() request) async {
    final T? data;
    try {
      data = (await request()).data;
    } on DioException catch (error) {
      throw apiFailureOf(error);
    }
    if (data == null) throw const ApiUnexpected();
    return data;
  }

  PixTransfer _transferOf(api.PixTransfer transfer) {
    final status = switch (transfer.status) {
      api.PixTransferStatusEnum.AWAITING_AUTH => PixStatus.awaitingAuth,
      api.PixTransferStatusEnum.PROCESSING => PixStatus.processing,
      api.PixTransferStatusEnum.COMPLETED => PixStatus.completed,
      api.PixTransferStatusEnum.FAILED => PixStatus.failed,
      api.PixTransferStatusEnum.CANCELLED => PixStatus.cancelled,
      api.PixTransferStatusEnum.unknownDefaultOpenApi =>
        throw const ApiUnexpected(),
    };
    final reason = switch (transfer.failureReason) {
      null => null,
      api.PixTransferFailureReasonEnum.INSUFFICIENT_FUNDS =>
        PixFailureReason.insufficientFunds,
      api.PixTransferFailureReasonEnum.LIMIT_EXCEEDED =>
        PixFailureReason.limitExceeded,
      api.PixTransferFailureReasonEnum.PAYEE_UNAVAILABLE =>
        PixFailureReason.payeeUnavailable,
      api.PixTransferFailureReasonEnum.ACCOUNT_BLOCKED =>
        PixFailureReason.accountBlocked,
      api.PixTransferFailureReasonEnum.PAYEE_BANK_REJECTED =>
        PixFailureReason.payeeBankRejected,
      // A reason a later API adds (A4): the Pix failed, unexplained.
      api.PixTransferFailureReasonEnum.unknownDefaultOpenApi =>
        PixFailureReason.unknown,
    };
    // A failed Pix always says why, and only a failed one does.
    if ((status == PixStatus.failed) != (reason != null)) {
      throw const ApiUnexpected();
    }
    final cents = reaisCentsOf(transfer.amount);
    if (cents <= 0) throw const ApiUnexpected();
    final payee = transfer.payee;
    return PixTransfer(
      id: transfer.id,
      status: status,
      amountCents: cents,
      description: transfer.description,
      payee: PixPayee(
        name: payee.name,
        documentMasked: payee.documentMasked,
        keyType: switch (payee.keyType) {
          api.PixPayeeKeyTypeEnum.CPF => PixKeyType.cpf,
          api.PixPayeeKeyTypeEnum.EMAIL => PixKeyType.email,
          api.PixPayeeKeyTypeEnum.PHONE => PixKeyType.phone,
          api.PixPayeeKeyTypeEnum.RANDOM => PixKeyType.random,
          api.PixPayeeKeyTypeEnum.unknownDefaultOpenApi =>
            throw const ApiUnexpected(),
        },
        keyMasked: payee.keyMasked,
        bankName: payee.bank?.name,
      ),
      endToEndId: transfer.endToEndId,
      failureReason: reason,
      createdAt: transfer.createdAt,
      completedAt: transfer.completedAt,
    );
  }
}
