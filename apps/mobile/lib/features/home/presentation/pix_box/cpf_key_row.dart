import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

/// The customer's CPF key: "CPF" and the CPF masked by the server on the
/// start, "Cadastrar" on the end. "Cadastrar" has no action yet
/// (developer's call): only its layout.
class CpfKeyRow extends StatelessWidget {
  /// Creates the row; [cpfMasked] is null while the profile loads.
  const new({required this.cpfMasked, super.key});

  /// The customer's CPF as the server masks it: never the full one.
  final String? cpfMasked;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return NbSurface(
      tone: NbSurfaceTone.inset,
      padding: const EdgeInsets.symmetric(
        horizontal: NbSpace.md,
        vertical: NbSpace.sm,
      ),
      // The CPF on the start, "Cadastrar" on the end: the CPF takes the room
      // left, which pushes the button to the edge.
      child: Row(
        children: [
          Icon(
            Icons.badge_outlined,
            size: NbSize.icon,
            color: colors.textMuted,
          ),
          const SizedBox(width: NbSpace.md),
          Expanded(child: _CpfLabel(cpfMasked: cpfMasked)),
          const SizedBox(width: NbSpace.sm),
          TextButton(
            onPressed: () {},
            // No padding of its own, so its text lines up with the row's end.
            style: TextButton.styleFrom(
              padding: EdgeInsets.zero,
              minimumSize: const Size(0, NbSize.touch),
            ),
            child: const Text('Cadastrar', maxLines: 1),
          ),
        ],
      ),
    );
  }
}

class _CpfLabel extends StatelessWidget {
  const new({required this.cpfMasked});

  final String? cpfMasked;

  @override
  Widget build(BuildContext context) {
    final cpf = cpfMasked;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('CPF', style: context.nbText.bodyText),
        if (cpf != null) Text(cpf, style: context.nbText.caption),
      ],
    );
  }
}
