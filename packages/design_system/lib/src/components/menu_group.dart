import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// Rows of a menu in one card, split by a line between each two, as in the
/// profile (v1.1.0 plan, task 4.4).
class MenuGroup extends StatelessWidget {
  /// Creates the group; [children] are usually [MenuRow]s.
  const new({required this.children, super.key});

  /// The rows, from top to bottom.
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NbRadius.box),
        side: BorderSide(color: colors.border),
      ),
      // Clips each row's ink to the card's corners.
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (final (index, row) in children.indexed) ...[
            if (index > 0) Divider(height: 1, color: colors.border),
            row,
          ],
        ],
      ),
    );
  }
}

/// One row of a [MenuGroup]: an optional icon, the title and an arrow. With
/// [selected], it is one choice among others, as a theme: a check marks the
/// one that is on, and screen readers hear it.
class MenuRow extends StatelessWidget {
  /// Creates the row.
  const new({
    required this.title,
    required this.onTap,
    this.icon,
    this.selected,
    super.key,
  });

  /// What the row is about, in the accent color; none for a plain row,
  /// such as a question.
  final IconData? icon;

  /// What the row opens or chooses.
  final String title;

  /// Called on tap.
  final VoidCallback onTap;

  /// Null for a row that opens something; true or false for a choice.
  final bool? selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final isChoice = selected != null;

    return Semantics(
      button: true,
      selected: selected,
      inMutuallyExclusiveGroup: isChoice ? true : null,
      label: title,
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(NbSpace.lg),
          child: Row(
            children: [
              if (icon case final icon?) ...[
                Icon(icon, size: NbSize.icon, color: colors.accent),
                const SizedBox(width: NbSpace.md),
              ],
              Expanded(
                child: Text(
                  title,
                  style: NbType.bodyText.copyWith(color: colors.text),
                ),
              ),
              if (!isChoice)
                Icon(Icons.chevron_right, color: colors.textMuted)
              else if (selected ?? false)
                Icon(Icons.check, color: colors.accent),
            ],
          ),
        ),
      ),
    );
  }
}
