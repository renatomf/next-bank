import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/domain/top_up_repository.dart';
import 'package:nextbank_api/nextbank_api.dart' as api;

/// [TopUpRepository] over the generated API client (ADR 0008). What the
/// client lets through that the server never sends, such as an amount that
/// is not positive or a number not masked, is refused here (MASVS, code;
/// F-18): the app never shows a number in full (READ-02).
class HttpTopUpRepository implements TopUpRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final api.DefaultApi _api;

  @override
  Future<List<TopUpOperator>> operators() async {
    final list = await _call(_api.getTopUpOperators);
    return [
      for (final operator in list.operators)
        TopUpOperator(
          id: operator.id,
          name: operator.name,
          initials: operator.initials,
          amountsCents: [for (final money in operator.amounts) _cents(money)],
        ),
    ];
  }

  @override
  Future<TopUp> create({
    required String operatorId,
    required String phoneDigits,
    required int amountCents,
    required String pin,
    required String idempotencyKey,
  }) async => _topUpOf(
    await _call(
      () => _api.createTopUp(
        idempotencyKey: idempotencyKey,
        createTopUpRequestInput: api.CreateTopUpRequestInput(
          operatorId: operatorId,
          phoneNumber: phoneDigits,
          amount: api.MoneyInput(
            amount: amountCents,
            currency: api.MoneyInputCurrencyEnum.BRL,
          ),
          pin: pin,
        ),
      ),
    ),
  );

  @override
  Future<TopUp> fetch(String topUpId) async =>
      _topUpOf(await _call(() => _api.getTopUp(topUpId: topUpId)));

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

  TopUp _topUpOf(api.TopUp topUp) {
    if (!_masked.hasMatch(topUp.phoneMasked)) throw const ApiUnexpected();
    return TopUp(
      id: topUp.id,
      operatorName: topUp.operator_.name,
      operatorInitials: topUp.operator_.initials,
      phoneMasked: topUp.phoneMasked,
      amountCents: _cents(topUp.amount),
      createdAt: topUp.createdAt,
    );
  }
}

// The area code and the last four digits only, as the server masks it.
final RegExp _masked = RegExp(r'^\([0-9]{2}\) \*{5}-[0-9]{4}$');

int _cents(api.Money money) {
  if (money.amount <= 0) throw const ApiUnexpected();
  return money.amount;
}
