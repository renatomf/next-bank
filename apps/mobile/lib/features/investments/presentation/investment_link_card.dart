import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// A card that leads somewhere: its icon, title, a line on what it is and
/// an arrow, as portability and Home Broker. It says it is coming for now.
class InvestmentLinkCard extends StatelessWidget {
  /// Creates the card.
  const new({
    required this.icon,
    required this.title,
    required this.description,
    super.key,
  });

  /// What the card is about.
  final IconData icon;

  /// Where it leads.
  final String title;

  /// What it is.
  final String description;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Semantics(
      container: true,
      button: true,
      label: '$title. $description',
      onTap: sayComingSoon,
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.box),
          side: BorderSide(color: colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: sayComingSoon,
          child: Padding(
            padding: const EdgeInsets.all(NbSpace.lg),
            child: Row(
              spacing: NbSpace.md,
              children: [
                Icon(icon, size: NbSize.icon, color: colors.accent),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    spacing: NbSpace.xs,
                    children: [
                      Text(title, style: context.nbText.bodyStrong),
                      Text(description, style: context.nbText.caption),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: colors.textMuted),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
