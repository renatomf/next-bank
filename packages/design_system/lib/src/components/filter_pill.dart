import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// A filter that turns on and off (v1.1.0 plan, task 4.1): a pill with an
/// icon and its label; on, it takes the accent border and a check.
class FilterPill extends StatelessWidget {
  /// Creates the pill.
  const new({
    required this.label,
    required this.selected,
    required this.onPressed,
    this.icon,
    super.key,
  });

  /// What it filters, also read by screen readers.
  final String label;

  /// Whether the filter is on.
  final bool selected;

  /// Turns the filter on or off.
  final VoidCallback onPressed;

  /// Shown before the label while off; a check takes its place while on.
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final leading = selected ? Icons.check : icon;
    return Semantics(
      container: true,
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: Material(
        color: selected ? colors.surface2 : colors.surface,
        shape: StadiumBorder(
          side: BorderSide(color: selected ? colors.accent : colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: NbSpace.lg,
              vertical: NbSpace.sm,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (leading != null) ...[
                  Icon(
                    leading,
                    size: 18,
                    color: selected ? colors.accent : colors.text,
                  ),
                  const SizedBox(width: NbSpace.sm),
                ],
                Text(
                  label,
                  style: NbType.bodyText.copyWith(color: colors.text),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
