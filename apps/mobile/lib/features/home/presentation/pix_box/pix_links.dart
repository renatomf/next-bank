import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_box.dart';

/// Pix Automático and Minhas chaves, in one row split by a line.
class PixLinks extends StatelessWidget {
  /// Creates the links; the box says where each one goes.
  const new({required this.onAutomatic, required this.onKeys, super.key});

  /// Opens "Pix Automático".
  final VoidCallback onAutomatic;

  /// Opens "Minhas chaves".
  final VoidCallback onKeys;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        children: [
          Expanded(
            child: _PixLink(
              icon: const PixMark(size: pixBoxIconSize),
              label: 'Pix Automático',
              text: 'Pix\nAutomático',
              onPressed: onAutomatic,
            ),
          ),
          VerticalDivider(
            width: 1,
            indent: NbSpace.sm,
            endIndent: NbSpace.sm,
            color: context.nbColors.border,
          ),
          Expanded(
            child: _PixLink(
              icon: const Icon(Icons.key_outlined, size: pixBoxIconSize),
              label: 'Minhas chaves',
              text: 'Minhas\nchaves',
              onPressed: onKeys,
            ),
          ),
        ],
      ),
    );
  }
}

/// An icon beside a two-line text, read by screen readers as one [label].
class _PixLink extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.text,
    required this.onPressed,
  });

  final Widget icon;
  final String label;
  final String text;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      button: true,
      label: label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
        child: Padding(
          padding: const EdgeInsets.all(NbSpace.sm),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              IconTheme.merge(
                data: IconThemeData(color: colors.accent),
                child: icon,
              ),
              const SizedBox(width: NbSpace.sm),
              Flexible(
                child: Text(
                  text,
                  style: NbType.caption.copyWith(color: colors.accent),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
