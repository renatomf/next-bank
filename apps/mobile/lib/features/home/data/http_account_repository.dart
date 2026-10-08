import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/home/domain/account_repository.dart';
import 'package:next_bank/features/home/domain/account_summary.dart';
import 'package:nextbank_api/nextbank_api.dart';

/// [AccountRepository] over the generated API client (ADR 0008). The client
/// already refuses a fractional amount or an unknown currency; a negative
/// balance, which the server never sends, is refused here (MASVS, code).
class HttpAccountRepository implements AccountRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final DefaultApi _api;

  @override
  Future<AccountSummary> fetch() async {
    final MyAccount account;
    try {
      account = (await _api.getMyAccount()).data!;
    } on DioException catch (error) {
      throw apiFailureOf(error);
    }
    final cents = account.availableBalance.amount;
    if (cents < 0) throw const ApiUnexpected();
    return AccountSummary(
      branch: account.branch,
      number: account.number,
      availableBalanceCents: cents,
    );
  }
}
