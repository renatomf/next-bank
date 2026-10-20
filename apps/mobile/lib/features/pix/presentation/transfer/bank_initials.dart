import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// A bank's initials in a circle, in place of its logo: logos are marks of
/// third parties (repository rules) and would weigh on the app.
class BankInitials extends StatelessWidget {
  /// Creates the circle with [initials].
  const new({required this.initials, super.key});

  /// Two or three characters, e.g. "BB".
  final String initials;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return ExcludeSemantics(
      child: Container(
        width: 40,
        height: 40,
        padding: const EdgeInsets.all(NbSpace.xs),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: colors.surface2,
          shape: BoxShape.circle,
          border: Border.all(color: colors.border),
        ),
        // Three characters shrink to fit the circle.
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Text(
            initials,
            style: NbType.cardLabel.copyWith(
              color: colors.accent,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
