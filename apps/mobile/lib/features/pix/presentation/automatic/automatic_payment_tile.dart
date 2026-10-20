import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/presentation/automatic/example_automatic_payments.dart';

/// One account in Pix Automático: its icon in a circle, the company and
/// what it is, the amount and how often, and an arrow to its details.
class AutomaticPaymentTile extends StatelessWidget {
  /// Creates the row for [payment].
  const new({required this.payment, required this.onTap, super.key});

  /// The account shown.
  final ExampleAutomaticPayment payment;

  /// Opens the account's details.
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final title = '${payment.company} · ${payment.description}';
    final amount = '${payment.amount} · ${payment.frequency}';

    return Semantics(
      button: true,
      label: '$title. $amount',
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NbSpace.md),
          child: Row(
            children: [
              NbIconCircle(icon: payment.icon),
              const SizedBox(width: NbSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: NbSpace.xs,
                  children: [
                    Text(title, style: context.nbText.caption),
                    Text(amount, style: context.nbText.bodyText),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: colors.textMuted),
            ],
          ),
        ),
      ),
    );
  }
}
