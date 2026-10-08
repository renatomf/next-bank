import 'package:design_system/src/components/dither.dart';
import 'package:design_system/src/components/icon_circle_button.dart';
import 'package:design_system/src/components/money_text.dart';
import 'package:design_system/src/components/silk.dart';
import 'package:design_system/src/components/skeleton.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The amount being sent (brief, section 7; pix-dark mockup): always dark
/// like the balance card, the amount large, a pencil to type it, and the
/// available balance below, hidden when the customer hid it (MOB-05).
class AmountCard extends StatelessWidget {
  /// Creates the card; a null [balanceCents] means it is still loading.
  const new({
    required this.cents,
    required this.balanceCents,
    required this.balanceHidden,
    required this.onEdit,
    super.key,
  });

  /// The amount typed, in integer cents.
  final int cents;

  /// The available balance in integer cents.
  final int? balanceCents;

  /// True while the customer chose to hide the balance.
  final bool balanceHidden;

  /// Asks the screen to let the customer type the amount.
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final balance = balanceCents;
    final label = NbType.bodyText.copyWith(color: NbBalanceCardColors.text);
    final small = NbType.caption.copyWith(color: NbBalanceCardColors.textMuted);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NbRadius.card),
        border: Border.all(color: NbBalanceCardColors.border),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(NbRadius.card),
        child: Stack(
          children: [
            const Positioned.fill(child: Silk()),
            const Positioned.fill(child: Dither()),
            Padding(
              padding: const EdgeInsets.all(NbSpace.screen),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Quanto você quer enviar?', style: label),
                  const SizedBox(height: NbSpace.lg),
                  Row(
                    children: [
                      Expanded(
                        // A large amount shrinks to fit, never breaks.
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: MoneyText(
                            cents: cents,
                            color: NbBalanceCardColors.text,
                            mutedColor: NbBalanceCardColors.textMuted,
                          ),
                        ),
                      ),
                      const SizedBox(width: NbSpace.md),
                      IconCircleButton(
                        icon: Icons.edit_outlined,
                        label: 'Digitar o valor',
                        onPressed: onEdit,
                        background: NbBalanceCardColors.button,
                        foreground: NbBalanceCardColors.text,
                        borderColor: NbBalanceCardColors.buttonBorder,
                        iconSize: 18,
                      ),
                    ],
                  ),
                  const SizedBox(height: NbSpace.lg),
                  Row(
                    children: [
                      Expanded(child: Text('Saldo disponível', style: small)),
                      if (balance == null)
                        const Skeleton(
                          width: 96,
                          height: 14,
                          color: NbBalanceCardColors.placeholder,
                        )
                      else
                        Semantics(
                          label: balanceHidden
                              ? 'Saldo oculto'
                              : formatReais(balance).full,
                          excludeSemantics: true,
                          child: Text(
                            balanceHidden
                                ? r'R$ ••••••'
                                : formatReais(balance).full,
                            style: NbType.caption.copyWith(
                              color: NbBalanceCardColors.text,
                              fontWeight: FontWeight.w700,
                              fontVariations: const [FontVariation.weight(700)],
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
