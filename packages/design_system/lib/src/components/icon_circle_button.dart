import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// Round icon button of the mockups' headers (brief, section 7): 44 across,
/// the minimum touch target, with its action named for screen readers.
class IconCircleButton extends StatelessWidget {
  /// Creates the button; a null [onPressed] disables it.
  const new({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.background,
    this.foreground,
    this.borderColor,
    this.iconSize = 20,
    super.key,
  });

  /// The icon shown.
  final IconData icon;

  /// What the button does, read by screen readers (it has no visible text).
  final String label;

  /// Called on tap; null disables the button.
  final VoidCallback? onPressed;

  /// Fill; defaults to the theme's surface.
  final Color? background;

  /// Icon color; defaults to the theme's text.
  final Color? foreground;

  /// Border; defaults to the theme's border.
  final Color? borderColor;

  /// Icon size: 20 in headers, 18 on the balance card (mockup).
  final double iconSize;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    // Its own node: otherwise the button merges with its neighbours and a
    // screen reader announces them all as one button.
    return Semantics(
      container: true,
      button: true,
      enabled: onPressed != null,
      label: label,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: NbSize.touch,
        child: Material(
          color: background ?? colors.surface,
          shape: CircleBorder(
            side: BorderSide(color: borderColor ?? colors.border),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed,
            // The accent green by default, as the app's icons (S21 checkpoint).
            child: Icon(
              icon,
              size: iconSize,
              color: foreground ?? colors.accent,
            ),
          ),
        ),
      ),
    );
  }
}
