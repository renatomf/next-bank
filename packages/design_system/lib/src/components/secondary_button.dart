import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// Pill button for the second action of a screen (brief, section 7;
/// comprovante-dark mockup): 56 high, outlined on the surface, no arrow.
class SecondaryButton extends StatelessWidget {
  /// Creates the button; a null [onPressed] disables it.
  const new({required this.label, required this.onPressed, super.key});

  /// What the action does, also read by screen readers.
  final String label;

  /// Called on tap; null disables the button.
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    return Semantics(
      container: true,
      button: true,
      enabled: onPressed != null,
      label: label,
      excludeSemantics: true,
      child: SizedBox(
        height: NbSize.button,
        width: double.infinity,
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            backgroundColor: colors.surface,
            foregroundColor: colors.text,
            side: BorderSide(color: colors.border),
            shape: const StadiumBorder(),
            textStyle: NbType.button,
          ),
          child: Text(label, overflow: TextOverflow.ellipsis),
        ),
      ),
    );
  }
}
