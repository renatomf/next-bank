import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// A titled group of menu rows, as "Conta" or "Personalização".
class MenuSection extends StatelessWidget {
  /// Creates the section.
  const new({required this.title, required this.rows, super.key});

  /// The section's name, above the card.
  final String title;

  /// The rows in the card.
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(title, style: Theme.of(context).textTheme.titleMedium),
        ),
        const SizedBox(height: NbSpace.md),
        MenuGroup(children: rows),
      ],
    );
  }
}
