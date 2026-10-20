import 'package:design_system/src/components/nb_chip.dart';
import 'package:flutter/material.dart';

/// A filter that turns on and off (v1.1.0 plan, task 4.1): a pill with an
/// icon and its label; on, it takes the accent border and a check. The
/// look is the [NbChip]'s, shared with the app's action chips.
class FilterPill extends StatelessWidget {
  /// Creates the pill.
  const new({
    required this.label,
    required this.selected,
    required this.onPressed,
    this.icon,
    super.key,
  });

  /// What it filters, also read by screen readers.
  final String label;

  /// Whether the filter is on.
  final bool selected;

  /// Turns the filter on or off.
  final VoidCallback onPressed;

  /// Shown before the label while off; a check takes its place while on.
  final IconData? icon;

  @override
  Widget build(BuildContext context) => NbChip(
    label: label,
    icon: selected ? Icons.check : icon,
    selected: selected,
    onPressed: onPressed,
  );
}
