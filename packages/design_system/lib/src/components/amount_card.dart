import 'package:design_system/src/components/glass_art.dart';
import 'package:design_system/src/components/icon_circle_button.dart';
import 'package:design_system/src/components/money_text.dart';
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

  /// Asks the screen to let the customer type the amount; null when the
  /// amount is fixed, as one read from a QR Code (PIX-13): a lock replaces
  /// the pencil.
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final balance = balanceCents;
    final label = NbType.bodyText.copyWith(color: NbGlassColors.text);
    final small = NbType.caption.copyWith(color: NbGlassColors.textMuted);
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(NbRadius.card),
        border: Border.all(color: NbGlassColors.border),
        // The balance card's mint glow underneath, so both cards match.
        boxShadow: const [
          BoxShadow(
            color: NbGlassColors.shadow,
            offset: Offset(0, 18),
            blurRadius: 42,
            spreadRadius: -12,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(NbRadius.card),
        child: Stack(
          children: [
            const Positioned.fill(child: GlassArt()),
            // The texts sit right on the art: the deep tint keeps them AA.
            const Positioned.fill(
              child: ColoredBox(color: NbGlassColors.tintDeep),
            ),
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
                            color: NbGlassColors.text,
                            mutedColor: NbGlassColors.textMuted,
                          ),
                        ),
                      ),
                      const SizedBox(width: NbSpace.md),
                      if (onEdit case final onEdit?)
                        IconCircleButton(
                          icon: Icons.edit_outlined,
                          label: 'Digitar o valor',
                          onPressed: onEdit,
                          background: NbGlassColors.button,
                          foreground: NbGlassColors.text,
                          borderColor: NbGlassColors.buttonBorder,
                          iconSize: 18,
                        )
                      else
                        Semantics(
                          label: 'Valor definido pelo QR Code',
                          child: const ExcludeSemantics(
                            child: Icon(
                              Icons.lock_outline,
                              size: 20,
                              color: NbGlassColors.text,
                            ),
                          ),
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
                          color: NbGlassColors.placeholder,
                        )
                      else
                        Semantics(
                          // Its own node, like the balance on the Home.
                          container: true,
                          label: balanceHidden
                              ? 'Saldo oculto'
                              : formatReais(balance).full,
                          excludeSemantics: true,
                          child: Text(
                            balanceHidden
                                ? r'R$ ••••••'
                                : formatReais(balance).full,
                            style: NbType.caption.copyWith(
                              color: NbGlassColors.text,
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
