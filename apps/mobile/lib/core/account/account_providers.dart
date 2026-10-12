import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_repository.dart';
import 'package:next_bank/core/account/account_summary.dart';

/// Where the account comes from. Bound to `HttpAccountRepository` by the
/// composition root (`main.dart`); tests override it with a fake.
final Provider<AccountRepository> accountRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// The customer's account, loaded while a screen that shows it is open and
/// dropped when the last one leaves, so a sign-out never leaves it behind.
/// Not retried automatically: offline, the screen says so and offers to try
/// again.
final FutureProvider<AccountSummary> accountProvider =
    FutureProvider.autoDispose(
      (ref) => ref.watch(accountRepositoryProvider).fetch(),
      retry: (_, _) => null,
    );

/// Whether the balance is hidden (MOB-05), on every screen that shows it: the
/// Home and the Pix. Hidden at every opening and kept only in memory; the
/// movements always show their amounts (week 8 plan, V14, changing week 6's
/// D8).
final NotifierProvider<BalanceVisibility, bool> balanceHiddenProvider =
    NotifierProvider(BalanceVisibility.new);

/// Hides or shows the balance.
class BalanceVisibility extends Notifier<bool> {
  @override
  bool build() => true;

  /// Flips between hidden and shown.
  void toggle() => state = !state;
}
