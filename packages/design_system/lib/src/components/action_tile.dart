import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// A shortcut of the Home (brief, section 7; home-dark mockup): 84 high,
/// radius 20, an icon in the accent color over its label.
class ActionTile extends StatelessWidget {
  /// Creates the shortcut.
  const new({
    required this.icon,
    required this.label,
    required this.onPressed,
    super.key,
  });

  /// Height in the mockup; larger text grows it.
  static const double height = 84;

  /// What the shortcut shows: an [Icon], painted in the accent color, or any
  /// widget such as the Pix symbol (week 8 plan, V6).
  final Widget icon;

  /// Where it goes, also read by screen readers.
  final String label;

  /// Called on tap.
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      container: true,
      button: true,
      label: label,
      excludeSemantics: true,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: height),
        child: Material(
          color: colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(NbRadius.block),
            side: BorderSide(color: colors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: NbSpace.xs,
                vertical: NbSpace.md,
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  IconTheme.merge(
                    data: IconThemeData(size: 22, color: colors.accent),
                    child: icon,
                  ),
                  const SizedBox(height: NbSpace.sm),
                  // One line, shrinking only as much as a narrow tile needs, so
                  // the four shortcuts keep one size (week 8 plan, V13).
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Text(
                      label,
                      maxLines: 1,
                      textAlign: TextAlign.center,
                      style: NbType.caption.copyWith(color: colors.text),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
