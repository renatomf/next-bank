import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// One movement in a list (brief, section 7; home-dark mockup): an arrow in a
/// circle, a title, a caption and the amount with its sign. In or out reads
/// from the arrow and the sign, never from color alone (brief, section 8).
class TransactionItem extends StatelessWidget {
  /// Creates the row; a null [onTap] makes it read-only.
  const new({
    required this.title,
    required this.caption,
    required this.amountCents,
    required this.incoming,
    this.onTap,
    super.key,
  });

  /// What moved the money, e.g. "Pix recebido".
  final String title;

  /// Who and when, e.g. "Mariana Costa · Hoje, 09:12".
  final String caption;

  /// The amount in integer cents, always positive.
  final int amountCents;

  /// True when the money came in.
  final bool incoming;

  /// Opens the movement's detail.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final sign = incoming ? '+' : '−';
    final reais = formatReais(amountCents).full;
    final spoken = '${incoming ? 'entrada' : 'saída'} de $reais';
    return Semantics(
      container: true,
      button: onTap != null,
      label: '$title, $caption, $spoken',
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(NbRadius.field),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NbSpace.md),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: incoming
                      ? colors.accent.withValues(alpha: 0.14)
                      : colors.surface2,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  incoming ? Icons.south_west : Icons.north_east,
                  size: 20,
                  color: incoming ? colors.accent : colors.text,
                ),
              ),
              const SizedBox(width: NbSpace.md),
              // The words get more room than the reais, and the title stays
              // on one line, shrinking only when it must.
              Expanded(
                flex: 3,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    FittedBox(
                      fit: BoxFit.scaleDown,
                      alignment: Alignment.centerLeft,
                      child: Text(
                        title,
                        maxLines: 1,
                        style: NbType.bodyText.copyWith(
                          color: colors.text,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      caption,
                      style: NbType.caption.copyWith(
                        color: colors.textMuted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: NbSpace.md),
              // Shares the width with the title and shrinks to fit, so a large
              // amount never overflows a small phone (brief, section 8).
              Flexible(
                flex: 2,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  alignment: Alignment.centerRight,
                  child: Text(
                    '$sign $reais',
                    style: NbType.bodyStrong.copyWith(color: colors.text),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
