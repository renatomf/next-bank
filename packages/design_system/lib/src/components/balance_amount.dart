import 'package:design_system/src/components/money_text.dart';
import 'package:design_system/src/components/skeleton.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// What the glass panel of a balance card shows: "Saldo disponível" with
/// the masked account over the balance, or placeholders while either is
/// unknown. Shared by the Home's card and the statement's (v1.1.0 plan, task
/// 4.1); internal to the design system.
class BalanceAmount extends StatelessWidget {
  /// Creates the content; a null [accountNumber] or [cents] shows it loading.
  const new({
    required this.accountNumber,
    required this.cents,
    required this.hidden,
    super.key,
  });

  /// The account number, e.g. "100000-4"; only its last four digits show.
  final String? accountNumber;

  /// The available balance in integer cents.
  final int? cents;

  /// True while the customer chose to hide the balance (MOB-05).
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    final number = accountNumber;
    final amount = cents;
    if (number == null || amount == null) return const _LoadingBalance();
    return _Balance(accountNumber: number, cents: amount, hidden: hidden);
  }
}

class _Balance extends StatelessWidget {
  const new({
    required this.accountNumber,
    required this.cents,
    required this.hidden,
  });

  final String accountNumber;
  final int cents;
  final bool hidden;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Saldo disponível · Conta ${_masked(accountNumber)}',
          style: NbType.cardLabel.copyWith(
            color: NbBalanceCardColors.textMuted,
          ),
        ),
        const SizedBox(height: NbSpace.xs),
        // A large balance shrinks to fit instead of breaking the line.
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: MoneyText(
            cents: cents,
            hidden: hidden,
            color: NbBalanceCardColors.text,
            mutedColor: NbBalanceCardColors.textMuted,
          ),
        ),
      ],
    );
  }

  /// Only the last four digits, as in the mockups: "•••• 0004".
  static String _masked(String number) {
    final digits = number.replaceAll(RegExp(r'\D'), '');
    return '•••• ${digits.substring(digits.length - 4)}';
  }
}

class _LoadingBalance extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Carregando saldo',
      container: true,
      child: const Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Skeleton(
            width: 180,
            height: 12,
            color: NbBalanceCardColors.placeholder,
          ),
          SizedBox(height: NbSpace.md),
          Skeleton(
            width: 200,
            height: 34,
            color: NbBalanceCardColors.placeholder,
          ),
        ],
      ),
    );
  }
}
