import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// Pill button for the main action of a screen (brief, section 7): 56 high,
/// label and a ↗ arrow. While [loading], it shows progress and ignores taps,
/// so a double tap never sends the same request twice.
class PrimaryButton extends StatelessWidget {
  /// Creates the button; a null [onPressed] disables it.
  const new({
    required this.label,
    required this.onPressed,
    this.loading = false,
    super.key,
  });

  /// What the action does, also read by screen readers.
  final String label;

  /// Called on tap; null disables the button.
  final VoidCallback? onPressed;

  /// True while the action runs.
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final enabled = onPressed != null && !loading;
    // Its own node: otherwise it merges with nearby text in a list.
    return Semantics(
      container: true,
      button: true,
      enabled: enabled,
      label: label,
      excludeSemantics: true,
      child: DecoratedBox(
        // The mint halo marks the action that can be taken (mockups).
        decoration: ShapeDecoration(
          shape: const StadiumBorder(),
          shadows: enabled
              ? const [
                  BoxShadow(
                    color: NbBrand.actionGlow,
                    offset: Offset(0, 10),
                    blurRadius: 32,
                    spreadRadius: -8,
                  ),
                ]
              : null,
        ),
        child: SizedBox(
          height: NbSize.button,
          width: double.infinity,
          child: FilledButton(
            onPressed: enabled ? onPressed : null,
            style: FilledButton.styleFrom(
              backgroundColor: colors.primary,
              foregroundColor: colors.onPrimary,
              disabledBackgroundColor: colors.primary.withValues(alpha: 0.4),
              disabledForegroundColor: colors.onPrimary,
              shape: const StadiumBorder(),
              textStyle: NbType.button,
            ),
            child: loading
                ? SizedBox.square(
                    dimension: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: colors.onPrimary,
                    ),
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Flexible(
                        child: Text(label, overflow: TextOverflow.ellipsis),
                      ),
                      const SizedBox(width: NbSpace.sm),
                      const Icon(Icons.north_east, size: 20),
                    ],
                  ),
          ),
        ),
      ),
    );
  }
}
