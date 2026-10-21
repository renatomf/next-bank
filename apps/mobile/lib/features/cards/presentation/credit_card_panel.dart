import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/core/ui/example_tag.dart';
import 'package:next_bank/features/cards/presentation/example_card_figures.dart';

/// What the credit card shows below the carousel: the current invoice, the
/// shortcuts and the latest purchases, all made up. Layout only: each
/// action says it is coming.
class CreditCardPanel extends StatelessWidget {
  /// Creates the panel.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
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
        Row(
          children: [
            Expanded(
              child: Text(
                'Últimas compras',
                style: context.nbText.sectionTitle,
              ),
            ),
            const ExampleTag(),
          ],
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

    return NbSurface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: NbSpace.sm,
        children: [
          Row(
            children: [
              Expanded(
                child: Text('Fatura atual', style: context.nbText.caption),
              ),
              const ExampleTag(),
            ],
          ),
          Text(
            formatReais(exampleInvoiceCents).full,
            style: context.nbText.screenTitle,
          ),
          Text('Vence em $exampleInvoiceDue', style: context.nbText.caption),
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
            style: context.nbText.caption,
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
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(purchase.name, style: context.nbText.bodyText),
              Text(purchase.date, style: context.nbText.caption),
            ],
          ),
        ),
        Text(formatReais(purchase.cents).full, style: context.nbText.bodyText),
      ],
    );
  }
}
