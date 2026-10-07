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

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: NbSize.touch,
        child: Material(
          color: background ?? colors.surface,
          shape: CircleBorder(side: BorderSide(color: colors.border)),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onPressed,
            child: Icon(icon, size: 20, color: foreground ?? colors.text),
          ),
        ),
      ),
    );
  }
}
