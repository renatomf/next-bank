import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// An area of the bar still without its layout, only its title (v1.1.0
/// plan, task 4.11): Cartões, Investimentos and Menu. No back arrow: the
/// bar is the way around. Each gets its own screen with its layout.
class AreaPlaceholderScreen extends StatelessWidget {
  /// Creates the area named [title].
  const new({required this.title, super.key});

  /// The area's name.
  final String title;

  @override
  Widget build(BuildContext context) => Scaffold(
    body: GlowBackground(
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(NbSpace.screen),
          child: Align(
            alignment: Alignment.topLeft,
            child: Semantics(
              header: true,
              child: Text(
                title,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
