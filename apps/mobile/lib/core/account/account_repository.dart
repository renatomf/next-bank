import 'package:next_bank/core/account/account_summary.dart';

/// Reads the signed-in customer's account from the API.
/// Failures are reported as `ApiFailure` with the catalog code.
abstract interface class AccountRepository {
  /// The account and its available balance.
  Future<AccountSummary> fetch();
}
