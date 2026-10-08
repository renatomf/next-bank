import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// The header of the Pix screens (pix-dark and comprovante-dark mockups): a
/// round button on the left and the title centered.
class PixHeader extends StatelessWidget {
  /// Creates the header.
  const new({
    required this.title,
    required this.icon,
    required this.iconLabel,
    required this.onPressed,
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
        // Keeps the title centered on the screen.
        const SizedBox(width: NbSize.touch),
      ],
    );
  }
}
