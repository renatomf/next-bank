import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/redirect.dart';

/// The frame of the app's areas: the screen above the navigation bar docked
/// at the bottom (week 7 plan, D7; week 8 plan, V4; domain-model.md 10). Part
/// of the app, not of a feature, since it knows every area.
class NavShell extends StatelessWidget {
  /// Creates the frame of the area at [location].
  const new({required this.location, required this.child, super.key});

  /// Where the app is, to mark the current destination.
  final String location;

  /// The area's screen.
  final Widget child;

  /// The areas of the bar, in order: Início and Cartões before the Pix,
  /// Invest and Menu after it (v1.1.0 plan, task 4.11). The
  /// statement, Security and the profile open from the Home and the
  /// profile, still over the bar.
  static const List<String> areas = [
    AppRoutes.home,
    AppRoutes.cards,
    AppRoutes.investments,
    AppRoutes.menu,
  ];

  @override
  Widget build(BuildContext context) {
    final selected = areas.indexOf(location);
    // Docked, the bar takes its own space: the screen ends above it.
    return Scaffold(
      body: child,
      bottomNavigationBar: NbNavBar(
        leading: const [
          (icon: Icons.home_outlined, label: 'Início'),
          (icon: Icons.credit_card, label: 'Cartões'),
        ],
        trailing: const [
          // Short enough for the bar (S21 checkpoint).
          (icon: Icons.stacked_line_chart, label: 'Invest'),
          (icon: Icons.more_horiz, label: 'Menu'),
        ],
        // The official symbol, by the developer's exception (week 8 plan, V6).
        action: (icon: const PixMark(), label: 'Pix'),
        selectedIndex: selected < 0 ? null : selected,
        onSelected: (index) => context.go(areas[index]),
        onAction: () => context.push(AppRoutes.pix),
      ),
    );
  }
}
