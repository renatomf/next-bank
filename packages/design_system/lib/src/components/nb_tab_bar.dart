import 'package:design_system/src/theme.dart';
import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// The app's tabs: the labels, the one that is on in bold with the accent
/// line under it (v1.1.0 plan, tasks 4.4 and 4.6).
class NbTabBar extends StatelessWidget {
  /// Creates the tabs, one per label, switched by [controller].
  const new({required this.controller, required this.labels, super.key});

  /// Which tab is on.
  final TabController controller;

  /// The tabs' names, in order.
  final List<String> labels;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return TabBar(
      controller: controller,
      indicatorColor: colors.accent,
      labelColor: colors.text,
      unselectedLabelColor: colors.textMuted,
      labelStyle: NbType.bodyStrong,
      unselectedLabelStyle: NbType.bodyText,
      dividerColor: Colors.transparent,
      tabs: [for (final label in labels) Tab(text: label)],
    );
  }
}
