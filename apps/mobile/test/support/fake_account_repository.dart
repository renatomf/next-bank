import 'package:next_bank/core/account/account_repository.dart';
import 'package:next_bank/core/account/account_summary.dart';

/// Fake [AccountRepository]: a funded demo account by default; [answer] can
/// hold a call open or make it fail.
class FakeAccountRepository implements AccountRepository {
  new({this.balanceCents = 1000000});

  int balanceCents;

  /// What the next call does before answering; by default nothing.
  Future<void> Function() answer = () async {};

  int fetches = 0;

  @override
  Future<AccountSummary> fetch() async {
    fetches++;
    await answer();
    return AccountSummary(
      branch: '0001',
      number: '100000-4',
      availableBalanceCents: balanceCents,
    );
  }
}
