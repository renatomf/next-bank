import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/menu/presentation/menu_sections.dart';

/// One card of the menu: the icon on top, the name below in up to two
/// lines and, for something new, a "Novo" badge. It says it is coming for
/// now: the links come later.
class MenuCard extends StatelessWidget {
  /// Creates the card for [item].
  const new({required this.item, super.key});

  /// What the card shows.
  final MenuItem item;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Semantics(
      container: true,
      button: true,
      label: item.isNew ? '${item.label}, novo' : item.label,
      onTap: sayComingSoon,
      excludeSemantics: true,
      child: Material(
        color: colors.surface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(NbRadius.boxInner),
          side: BorderSide(color: item.isNew ? colors.accent : colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: sayComingSoon,
          child: Padding(
            padding: const EdgeInsets.all(NbSpace.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Icon(item.icon, size: NbSize.icon, color: colors.accent),
                    // The badge on the end, shrinking on a narrow card.
                    if (item.isNew)
                      const Expanded(
                        child: Align(
                          alignment: Alignment.centerRight,
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: _NewBadge(),
                          ),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: NbSpace.lg),
                Text(
                  item.label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: context.nbText.caption.copyWith(color: colors.text),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NewBadge extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: NbSpace.sm, vertical: 2),
      decoration: BoxDecoration(
        color: colors.primary,
        borderRadius: BorderRadius.circular(NbSpace.sm),
      ),
      child: Text(
        'Novo',
        style: context.nbText.cardLabel.copyWith(color: colors.onPrimary),
      ),
    );
  }
}
