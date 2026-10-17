import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/home/presentation/pix_box/pix_box.dart';

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

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: NbSpace.md,
        vertical: NbSpace.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surface2,
        borderRadius: BorderRadius.circular(NbRadius.boxInner),
      ),
      child: Row(
        children: [
          Icon(
            Icons.badge_outlined,
            size: pixBoxIconSize,
            color: colors.textMuted,
          ),
          const SizedBox(width: NbSpace.md),
          Expanded(child: _CpfLabel(cpfMasked: cpfMasked)),
          // It may shrink only on a narrow screen with large text.
          const Flexible(child: _RegisterButton()),
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
    final colors = context.nbColors;
    final cpf = cpfMasked;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('CPF', style: NbType.bodyText.copyWith(color: colors.text)),
        if (cpf != null)
          Text(cpf, style: NbType.caption.copyWith(color: colors.textMuted)),
      ],
    );
  }
}

class _RegisterButton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: () {},
    style: TextButton.styleFrom(
      padding: const EdgeInsets.symmetric(horizontal: NbSpace.sm),
    ),
    child: const Text(
      'Cadastrar',
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    ),
  );
}
