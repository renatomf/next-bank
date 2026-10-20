import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// An invitation to set the investor profile, with "Definir perfil", which
/// says it is coming for now.
class InvestorProfileBox extends StatelessWidget {
  /// Creates the box.
  const new({
    required this.title,
    required this.description,
    this.icon,
    super.key,
  });

  /// The box's heading.
  final String title;

  /// Why to set the profile.
  final String description;

  /// A large picture on top, when given.
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return NbSurface(
      padding: const EdgeInsets.all(NbSpace.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: NbSpace.md,
        children: [
          if (icon case final icon?) Icon(icon, size: 64, color: colors.accent),
          Text(
            title,
            textAlign: TextAlign.center,
            style: context.nbText.sectionTitle,
          ),
          Text(
            description,
            textAlign: TextAlign.center,
            style: context.nbText.caption,
          ),
          const SizedBox(height: NbSpace.sm),
          PrimaryButton(
            label: 'Definir perfil',
            onPressed: () =>
                showNbToast(context, 'Em breve.', icon: Icons.info_outline),
          ),
        ],
      ),
    );
  }
}
