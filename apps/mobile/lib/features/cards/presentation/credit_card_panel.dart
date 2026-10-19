import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/cards/presentation/example_cards.dart';

/// What the credit card shows below the carousel: the current invoice, the
/// shortcuts and the latest purchases, all made up. Layout only: each
/// action says it is coming.
class CreditCardPanel extends StatelessWidget {
  /// Creates the panel.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: NbSpace.lg,
      children: [
        _InvoiceCard(onPay: sayComingSoon),
        NbGrid(
          children: [
            for (final (icon, label) in const [
              (Icons.credit_card, 'Cartão virtual'),
              (Icons.lock_outline, 'Bloquear cartão'),
              (Icons.tune, 'Ajustar limite'),
            ])
              ActionTile(
                icon: Icon(icon),
                label: label,
                onPressed: sayComingSoon,
              ),
          ],
        ),
        Text(
          'Últimas compras',
          style: NbType.sectionTitle.copyWith(color: colors.text),
        ),
        for (final purchase in examplePurchases) _PurchaseRow(purchase),
      ],
    );
  }
}

/// The current invoice, how much of the limit it uses and "Pagar fatura".
class _InvoiceCard extends StatelessWidget {
  const new({required this.onPay});

  final VoidCallback onPay;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    const available = exampleCreditLimitCents - exampleInvoiceCents;

    return Container(
      padding: const EdgeInsets.all(NbSpace.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(NbRadius.box),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: NbSpace.sm,
        children: [
          Text(
            'Fatura atual',
            style: NbType.caption.copyWith(color: colors.textMuted),
          ),
          Text(
            formatReais(exampleInvoiceCents).full,
            style: NbType.screenTitle.copyWith(color: colors.text),
          ),
          Text(
            'Vence em $exampleInvoiceDue',
            style: NbType.caption.copyWith(color: colors.textMuted),
          ),
          ClipRRect(
            borderRadius: BorderRadius.circular(NbSpace.xs),
            child: LinearProgressIndicator(
              value: exampleInvoiceCents / exampleCreditLimitCents,
              minHeight: 6,
              color: colors.accent,
              backgroundColor: colors.surface2,
            ),
          ),
          Text(
            'Limite disponível ${formatReais(available).full}',
            style: NbType.caption.copyWith(color: colors.textMuted),
          ),
          const SizedBox(height: NbSpace.sm),
          PrimaryButton(label: 'Pagar fatura', onPressed: onPay),
        ],
      ),
    );
  }
}

class _PurchaseRow extends StatelessWidget {
  const new(this.purchase);

  final ExamplePurchase purchase;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                purchase.name,
                style: NbType.bodyText.copyWith(color: colors.text),
              ),
              Text(
                purchase.date,
                style: NbType.caption.copyWith(color: colors.textMuted),
              ),
            ],
          ),
        ),
        Text(
          formatReais(purchase.cents).full,
          style: NbType.bodyText.copyWith(color: colors.text),
        ),
      ],
    );
  }
}
