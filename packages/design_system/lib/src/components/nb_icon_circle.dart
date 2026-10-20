import 'package:design_system/src/theme/theme.dart';
import 'package:design_system/src/tokens/tokens.dart';
import 'package:flutter/material.dart';

/// How a [NbIconCircle] is painted.
enum NbIconCircleTone {
  /// The icon on the second surface.
  plain,

  /// Like [plain], with a border.
  outlined,

  /// The icon's color at 14% behind it, the icon half the circle: how an
  /// operation ended.
  tinted,
}

/// An icon in a circle (v1.1.0 plan, task 4.17). Decorative: the text beside
/// it says what it means, so the screen reader skips it.
class NbIconCircle extends StatelessWidget {
  /// Draws [icon] in a circle of [size].
  const new({
    required this.icon,
    this.size = NbSize.touch,
    this.color,
    this.tone = NbIconCircleTone.plain,
    super.key,
  }) : assert(
         tone != NbIconCircleTone.tinted || color != null,
         'a tinted circle takes its tint from color',
       );

  /// The icon.
  final IconData icon;

  /// The circle's width and height.
  final double size;

  /// The icon's color; the accent when not given.
  final Color? color;

  /// How the circle is painted.
  final NbIconCircleTone tone;

  // The tint behind a tinted icon.
  static const double _tint = 0.14;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final iconColor = color ?? colors.accent;

    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: tone == NbIconCircleTone.tinted
              ? iconColor.withValues(alpha: _tint)
              : colors.surface2,
          border: tone == NbIconCircleTone.outlined
              ? Border.all(color: colors.border)
              : null,
        ),
        child: Icon(
          icon,
          size: tone == NbIconCircleTone.tinted ? size / 2 : NbSize.icon,
          color: iconColor,
        ),
      ),
    );
  }
}
