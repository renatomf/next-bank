import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/menu/presentation/menu_card.dart';
import 'package:next_bank/features/menu/presentation/menu_sections.dart';

/// The full menu (v1.1.0 plan, task 4.13), a destination of the bar, layout
/// only for now: the search and the sections of cards, three to a row. The
/// search and the cards do nothing yet.
class MenuScreen extends StatelessWidget {
  /// Creates the menu.
  const new({required this.onBack, super.key});

  /// Leaves the area, to the Home.
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              // As the Pix screen: back and the title centered.
              ScreenHeader(
                title: 'Menu',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
              ),
              const SizedBox(height: NbSpace.lg),
              const TextField(
                decoration: InputDecoration(
                  hintText: 'Buscar no app',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
              for (final section in menuSections) ...[
                const SizedBox(height: NbSpace.xl),
                Semantics(
                  header: true,
                  child: Text(
                    section.title,
                    style: NbType.sectionTitle.copyWith(color: colors.text),
                  ),
                ),
                const SizedBox(height: NbSpace.md),
                NbGrid(
                  children: [
                    for (final item in section.items) MenuCard(item: item),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
