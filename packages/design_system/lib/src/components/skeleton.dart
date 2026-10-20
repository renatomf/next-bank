import 'package:design_system/src/theme/theme.dart';
import 'package:flutter/material.dart';

/// A placeholder block where content is loading (domain-model.md, section
/// 11). Static on purpose: animations are a week 7 extra. Silent to screen
/// readers; the screen says what is loading.
class Skeleton extends StatelessWidget {
  /// Creates a block of [width] × [height].
  const new({required this.width, required this.height, this.color, super.key});

  /// Width of the block.
  final double width;

  /// Height of the block.
  final double height;

  /// Fill; defaults to the theme's surface2.
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: color ?? context.nbColors.surface2,
          borderRadius: BorderRadius.circular(height / 2),
        ),
      ),
    );
  }
}
