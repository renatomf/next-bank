import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/ui/balance/balance_card.dart';
import 'package:next_bank/core/ui/common_copy.dart';

/// The balance card: loading, ready, or an error with "Tentar de novo". The
/// eye hides the balance on every screen at once (MOB-05).
class BalanceSection extends ConsumerWidget {
  /// Creates the section; [onStatement] and [onSchedules] open the statement
  /// and the scheduled Pix from the card.
  const new({required this.onStatement, required this.onSchedules, super.key});

  /// Opens the statement.
  final VoidCallback onStatement;

  /// Opens the scheduled Pix.
  final VoidCallback onSchedules;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final account = ref.watch(accountProvider);
    final hidden = ref.watch(balanceHiddenProvider);
    void toggleHidden() => ref.read(balanceHiddenProvider.notifier).toggle();

    if (account.hasError && !account.hasValue) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: NbSpace.xl),
        child: ErrorState(
          retryLabel: CommonCopy.retry,
          message: 'Não foi possível carregar seu saldo.',
          onRetry: () => ref.invalidate(accountProvider),
        ),
      );
    }

    // While loading, the card shows its placeholders.
    final loaded = account.value;
    return RepaintBoundary(
      // The card's frosted glass is costly to paint: kept apart, it is not
      // painted again when the Home scrolls.
      child: BalanceCard(
        accountNumber: loaded?.number,
        balanceCents: loaded?.availableBalanceCents,
        hidden: hidden,
        onToggleHidden: toggleHidden,
        onStatement: onStatement,
        onSchedules: onSchedules,
      ),
    );
  }
}
