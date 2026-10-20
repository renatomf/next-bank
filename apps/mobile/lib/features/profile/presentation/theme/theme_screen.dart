import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/theme/theme_choice.dart';
import 'package:next_bank/core/theme/theme_controller.dart';

/// "Tema do app": the phone's, light or dark (week 7 plan, D9), on its own
/// screen since the profile's redesign (v1.1.0 plan, task 4.4).
class ThemeScreen extends ConsumerWidget {
  /// Creates the screen; the router says where back goes.
  const new({required this.onBack, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chosen = ref.watch(themeChoiceProvider).value ?? ThemeChoice.system;

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Tema do app',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              MenuGroup(
                children: [
                  for (final (choice, icon, title) in _choices)
                    MenuRow(
                      icon: icon,
                      title: title,
                      selected: choice == chosen,
                      onTap: () =>
                          ref.read(themeChoiceProvider.notifier).choose(choice),
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static const List<(ThemeChoice, IconData, String)> _choices = [
    (ThemeChoice.system, Icons.brightness_auto_outlined, 'Sistema'),
    (ThemeChoice.light, Icons.light_mode_outlined, 'Claro'),
    (ThemeChoice.dark, Icons.dark_mode_outlined, 'Escuro'),
  ];
}
