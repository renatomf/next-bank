import 'dart:ui';

import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The frosted glass the balance sits on, over the green art: blurred,
/// translucent and with a light border. Shared by the Home's card and the
/// statement's (v1.1.0 plan, task 4.1); internal to the design system.
class GlassPanel extends StatelessWidget {
  /// Wraps [child] in the glass, with [padding] inside it.
  const new({
    required this.child,
    this.padding = const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    super.key,
  });

  /// What sits on the glass.
  final Widget child;

  /// Room between the glass's border and [child].
  final EdgeInsets padding;

  @override
  Widget build(BuildContext context) {
    final shape = BorderRadius.circular(NbRadius.boxInner);
    return ClipRRect(
      borderRadius: shape,
      child: BackdropFilter(
        // CSS blur(14px) is a standard deviation of 14 px.
        filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
        child: Container(
          width: double.infinity,
          padding: padding,
          decoration: BoxDecoration(
            color: NbBalanceCardColors.glass,
            borderRadius: shape,
            border: Border.all(color: NbBalanceCardColors.glassBorder),
          ),
          child: child,
        ),
      ),
    );
  }
}
