import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/home/domain/account_repository.dart';
import 'package:next_bank/features/home/domain/account_summary.dart';

/// Where the account comes from. Bound to `HttpAccountRepository` by the
/// composition root (`main.dart`); tests override it with a fake.
final Provider<AccountRepository> accountRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// The customer's account, loaded while the Home is on screen and dropped
/// when it leaves, so a sign-out never leaves it behind. Not retried
/// automatically: offline, the Home says so and offers to try again.
final FutureProvider<AccountSummary> accountProvider =
    FutureProvider.autoDispose(
      (ref) => ref.watch(accountRepositoryProvider).fetch(),
      retry: (_, _) => null,
    );

/// Whether the customer hid the balance (MOB-05). Kept only in memory:
/// visible again when the app restarts (decision D8).
final NotifierProvider<BalanceVisibility, bool> balanceHiddenProvider =
    NotifierProvider(BalanceVisibility.new);

/// Hides or shows the balance.
class BalanceVisibility extends Notifier<bool> {
  @override
  bool build() => false;

  /// Flips between hidden and shown.
  void toggle() => state = !state;
}

/// The device's clock, for the greeting only (no business rule depends on
/// it); tests set the hour.
final Provider<DateTime Function()> nowProvider = Provider(
  (ref) => DateTime.now,
);

/// "Bom dia" before noon, "Boa tarde" before 18 h, "Boa noite" after.
String greetingFor(DateTime now) => switch (now.hour) {
  >= 5 && < 12 => 'Bom dia,',
  >= 12 && < 18 => 'Boa tarde,',
  _ => 'Boa noite,',
};
