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

  /// The areas of the bar, in order: Início and Extrato before the Pix,
  /// Segurança and Perfil after it.
  static const List<String> areas = [
    AppRoutes.home,
    AppRoutes.statement,
    AppRoutes.security,
    AppRoutes.profile,
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
          (icon: Icons.receipt_long_outlined, label: 'Extrato'),
        ],
        trailing: const [
          (icon: Icons.shield_outlined, label: 'Segurança'),
          (icon: Icons.person_outline, label: 'Perfil'),
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
