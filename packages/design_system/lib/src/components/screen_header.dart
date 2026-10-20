import 'package:design_system/src/components/icon_circle_button.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// The header of an inner screen (pix-dark and comprovante-dark mockups): a
/// round button on the left, the title centered and, optionally, an action
/// on the right, such as the Pix's balance eye.
class ScreenHeader extends StatelessWidget {
  /// Creates the header.
  const new({
    required this.title,
    required this.icon,
    required this.iconLabel,
    required this.onPressed,
    this.action,
    super.key,
  });

  /// The screen's name.
  final String title;

  /// Back arrow or close cross.
  final IconData icon;

  /// What the button does, for screen readers.
  final String iconLabel;

  /// Called on tap.
  final VoidCallback onPressed;

  /// A round button on the right, as wide as the one on the left.
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        IconCircleButton(icon: icon, label: iconLabel, onPressed: onPressed),
        Expanded(
          child: Semantics(
            header: true,
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          ),
        ),
        // The action, or its space: either way the title stays centered.
        action ?? const SizedBox(width: NbSize.touch),
      ],
    );
  }
}
