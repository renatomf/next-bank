import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:next_bank/app/redirect.dart';

/// The frame of the app's areas: the screen with the floating bar over it
/// (week 7 plan, D7; domain-model.md 10). Part of the app, not of a feature,
/// since it knows every area.
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

  /// Space between the bar and the bottom of the screen.
  static const double margin = NbSpace.lg;

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final selected = areas.indexOf(location);
    // The screens keep their content clear of the bar through the bottom
    // padding their SafeArea already reads.
    const reserved = FloatingNavBar.height + margin * 2;
    return Stack(
      children: [
        MediaQuery(
          data: media.copyWith(
            padding: media.padding.copyWith(
              bottom: media.padding.bottom + reserved,
            ),
          ),
          child: child,
        ),
        Positioned(
          left: NbSpace.screen,
          right: NbSpace.screen,
          bottom: media.padding.bottom + margin,
          child: FloatingNavBar(
            leading: const [
              (icon: Icons.home_outlined, label: 'Início'),
              (icon: Icons.receipt_long_outlined, label: 'Extrato'),
            ],
            trailing: const [
              (icon: Icons.shield_outlined, label: 'Segurança'),
              (icon: Icons.person_outline, label: 'Perfil'),
            ],
            action: (icon: Icons.diamond_outlined, label: 'Pix'),
            selectedIndex: selected < 0 ? null : selected,
            onSelected: (index) => context.go(areas[index]),
            onAction: () => context.push(AppRoutes.pix),
          ),
        ),
      ],
    );
  }
}
