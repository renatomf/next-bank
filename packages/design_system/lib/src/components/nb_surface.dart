import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// How a [NbSurface] sits on the screen.
enum NbSurfaceTone {
  /// A box on the background: surface, border and the box radius.
  card,

  /// Inside a box: the second surface, no border, a tighter radius.
  inset,

  /// Inside a box, as a line: only the border, a tighter radius.
  outlined,
}

/// A box that holds a block of content (v1.1.0 plan, task 4.17): one place
/// for the look screens used to build with a BoxDecoration.
class NbSurface extends StatelessWidget {
  /// Wraps [child] in a box of [tone].
  const new({
    required this.child,
    this.tone = NbSurfaceTone.card,
    this.padding = const EdgeInsets.all(NbSpace.lg),
    this.selected = false,
    super.key,
  });

  /// The content.
  final Widget child;

  /// How the box sits on the screen.
  final NbSurfaceTone tone;

  /// Room between the edge and [child].
  final EdgeInsetsGeometry padding;

  /// Whether the box is the chosen one: the border takes the accent.
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final border = Border.all(color: selected ? colors.accent : colors.border);

    return Container(
      padding: padding,
      decoration: switch (tone) {
        NbSurfaceTone.card => BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(NbRadius.box),
          border: border,
        ),
        NbSurfaceTone.inset => BoxDecoration(
          color: colors.surface2,
          borderRadius: BorderRadius.circular(NbRadius.boxInner),
        ),
        NbSurfaceTone.outlined => BoxDecoration(
          borderRadius: BorderRadius.circular(NbRadius.boxInner),
          border: border,
        ),
      },
      child: child,
    );
  }
}
