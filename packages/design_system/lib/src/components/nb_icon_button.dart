import 'package:design_system/src/theme.dart';
import 'package:flutter/material.dart';

/// A plain icon button, without the circle of the IconCircleButton, read by
/// screen readers as [label]: copy, share, favourite, more (v1.1.0 plan,
/// tasks 4.8 and 4.9).
class NbIconButton extends StatelessWidget {
  /// Creates the button.
  const new({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.color,
    super.key,
  });

  /// What the button shows.
  final IconData icon;

  /// What it does, for screen readers.
  final String label;

  /// Called on tap.
  final VoidCallback onPressed;

  /// The icon's color; the text color when null.
  final Color? color;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    onTap: onPressed,
    excludeSemantics: true,
    child: IconButton(
      onPressed: onPressed,
      icon: Icon(icon, color: color ?? context.nbColors.text),
    ),
  );
}
