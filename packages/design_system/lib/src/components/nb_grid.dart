import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// A grid of equal columns (v1.1.0 plan, tasks 4.5, 4.12 and 4.13): the
/// children fill rows of [columns], each row as tall as its tallest child;
/// a short last row keeps the columns of the others. For a handful of
/// children, laid out at once; long lists want a lazy grid instead.
class NbGrid extends StatelessWidget {
  /// Creates the grid.
  const new({
    required this.children,
    this.columns = 3,
    this.spacing = NbSpace.sm,
    super.key,
  });

  /// The children, in reading order.
  final List<Widget> children;

  /// How many to a row.
  final int columns;

  /// The gap between rows and between columns.
  final double spacing;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: spacing,
      children: [
        for (var start = 0; start < children.length; start += columns)
          IntrinsicHeight(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: spacing,
              children: [
                for (var i = start; i < start + columns; i++)
                  Expanded(
                    child: i < children.length
                        ? children[i]
                        : const SizedBox.shrink(),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}
