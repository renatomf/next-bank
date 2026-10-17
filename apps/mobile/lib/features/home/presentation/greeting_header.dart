import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// The top of the Home: the profile icon, the customer's first name and the
/// logo (week 8 plan, V8).
class GreetingHeader extends StatelessWidget {
  /// Creates the header for [firstName].
  const new({required this.firstName, super.key});

  /// The customer's first name.
  final String firstName;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Row(
      children: [
        const _ProfileIcon(),
        const SizedBox(width: NbSpace.md),
        Expanded(
          child: Text(
            firstName,
            style: NbType.bodyStrong.copyWith(color: colors.text),
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: NbSpace.md),
        const NextLogo(size: 24),
      ],
    );
  }
}

class _ProfileIcon extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    // Decoration only: screen readers hear the name right after it.
    return ExcludeSemantics(
      child: Container(
        width: NbSize.touch,
        height: NbSize.touch,
        decoration: BoxDecoration(
          color: colors.surface2,
          shape: BoxShape.circle,
          border: Border.all(color: colors.border),
        ),
        child: Icon(Icons.person_outline, color: colors.text),
      ),
    );
  }
}
