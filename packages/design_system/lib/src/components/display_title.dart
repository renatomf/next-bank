import 'package:design_system/src/theme/theme.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// The mockups' two-line display title (brief, section 3): the [lead] in
/// Sora 600, the [trail] in Sora 400 and muted. Read as one heading.
class DisplayTitle extends StatelessWidget {
  /// Creates the title, e.g. "Seu dinheiro," / "um passo à frente."
  const new({required this.lead, required this.trail, super.key});

  /// First line, in the main text color.
  final String lead;

  /// Second line, lighter and muted.
  final String trail;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    // Its own node, or the heading flag spreads to the texts around it.
    return Semantics(
      container: true,
      header: true,
      child: Text.rich(
        TextSpan(
          text: '$lead\n',
          children: [
            TextSpan(
              text: trail,
              style: NbType.displaySoft.copyWith(color: colors.textMuted),
            ),
          ],
        ),
        style: Theme.of(context).textTheme.displayLarge,
      ),
    );
  }
}
