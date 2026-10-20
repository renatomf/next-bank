import 'package:flutter/material.dart';

/// An on/off switch, three quarters of Material's (v1.1.0 plan, task 4.17):
/// the developer asked for a smaller one, and two screens had already drifted
/// to different sizes. Scaling draws it smaller and keeps its touch area.
class NbSwitch extends StatelessWidget {
  /// A switch showing [value].
  const new({
    required this.value,
    required this.onChanged,
    this.rowTakesTap = false,
    super.key,
  });

  /// Whether it is on.
  final bool value;

  /// Called with the new value; null disables it.
  final ValueChanged<bool>? onChanged;

  /// Whether the whole row around it is the touch target, so the switch
  /// only shows the state and needs no touch area of its own.
  final bool rowTakesTap;

  static const double _scale = 0.75;

  @override
  Widget build(BuildContext context) => Transform.scale(
    scale: _scale,
    child: Switch(
      value: value,
      onChanged: onChanged,
      materialTapTargetSize: rowTakesTap
          ? MaterialTapTargetSize.shrinkWrap
          : MaterialTapTargetSize.padded,
    ),
  );
}
