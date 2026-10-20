import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/account/account_providers.dart';

/// The customer's account details, with a share button that is only the
/// layout for now ("Em breve.").
class AccountCard extends ConsumerWidget {
  /// Creates the card.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final account = ref.watch(accountProvider).value;
    final detail = context.nbText.caption;

    return Container(
      padding: const EdgeInsets.all(NbSpace.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(NbRadius.box),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: NbSpace.xs,
              children: [
                Text(
                  account == null
                      ? 'Conta corrente'
                      : 'Conta corrente: ${_lastFour(account.number)}',
                  style: context.nbText.bodyStrong,
                ),
                Text('Banco: next bank', style: detail),
                if (account != null)
                  Text('Agência: ${account.branch}', style: detail),
                // The customer's key is random (task 3); its value lives in
                // "Receber".
                Text('Chave: aleatória', style: detail),
              ],
            ),
          ),
          IconCircleButton(
            icon: Icons.share_outlined,
            label: 'Compartilhar dados da conta',
            onPressed: () =>
                showNbToast(context, 'Em breve.', icon: Icons.info_outline),
          ),
        ],
      ),
    );
  }

  /// Only the last four digits, as everywhere (brief, section 7).
  static String _lastFour(String number) {
    final digits = number.replaceAll(RegExp(r'\D'), '');
    return '•••• ${digits.substring(digits.length - 4)}';
  }
}
