import 'package:design_system/src/theme/theme.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// A pill with an optional icon, its label and an optional trailing icon,
/// such as a dropdown's arrow (v1.1.0 plan, tasks 4.1 and 4.10). With
/// [selected], it is a toggle, as the statement's filters: on, it takes
/// the accent border and screen readers hear it.
class NbChip extends StatelessWidget {
  /// Creates the chip.
  const new({
    required this.label,
    required this.onPressed,
    this.icon,
    this.trailingIcon,
    this.selected,
    super.key,
  });

  /// What it does, also read by screen readers.
  final String label;

  /// Called on tap.
  final VoidCallback onPressed;

  /// Shown before the label.
  final IconData? icon;

  /// Shown after the label, such as a dropdown's arrow.
  final IconData? trailingIcon;

  /// Null for an action; true or false for a toggle that is on or off.
  final bool? selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final isOn = selected ?? false;
    final iconColor = isOn ? colors.accent : colors.text;

    return Semantics(
      container: true,
      button: true,
      selected: selected,
      label: label,
      onTap: onPressed,
      excludeSemantics: true,
      child: Material(
        color: isOn ? colors.surface2 : colors.surface,
        shape: StadiumBorder(
          side: BorderSide(color: isOn ? colors.accent : colors.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onPressed,
          // At least a touch target high (brief, section 8).
          child: ConstrainedBox(
            constraints: const BoxConstraints(
              minHeight: kMinInteractiveDimension,
            ),
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: NbSpace.lg,
                vertical: NbSpace.sm,
              ),
              // On a narrow room the content shrinks to fit, whole; in a list
              // that scrolls sideways it keeps its natural size.
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  spacing: NbSpace.sm,
                  children: [
                    if (icon case final icon?)
                      Icon(icon, size: 18, color: iconColor),
                    Text(
                      label,
                      style: NbType.bodyText.copyWith(color: colors.text),
                    ),
                    if (trailingIcon case final trailing?)
                      Icon(trailing, size: 18, color: colors.text),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
