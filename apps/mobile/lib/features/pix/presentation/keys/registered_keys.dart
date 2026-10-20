import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/presentation/keys/example_pix_keys.dart';

/// "Minhas chaves cadastradas": how many of the limit, then each key with
/// copy and share, which say they are coming for now.
class RegisteredKeys extends StatelessWidget {
  /// Creates the list of [keys].
  const new({required this.keys, super.key});

  /// The customer's keys.
  final List<ExamplePixKey> keys;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            'Minhas chaves cadastradas · ${keys.length} de $pixKeyLimit',
            style: context.nbText.sectionTitle,
          ),
        ),
        const SizedBox(height: NbSpace.md),
        MenuGroup(children: [for (final key in keys) _KeyRow(pixKey: key)]),
      ],
    );
  }
}

class _KeyRow extends StatelessWidget {
  const new({required this.pixKey});

  final ExamplePixKey pixKey;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Padding(
      padding: const EdgeInsets.all(NbSpace.lg),
      child: Row(
        children: [
          Icon(pixKey.icon, size: NbSize.icon, color: colors.accent),
          const SizedBox(width: NbSpace.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: NbSpace.xs,
              children: [
                Text(pixKey.type, style: context.nbText.bodyStrong),
                Text(pixKey.value, style: context.nbText.caption),
              ],
            ),
          ),
          NbIconButton(
            icon: Icons.copy_outlined,
            label: 'Copiar ${pixKey.type}',
            onPressed: sayComingSoon,
          ),
          NbIconButton(
            icon: Icons.ios_share,
            label: 'Compartilhar ${pixKey.type}',
            onPressed: sayComingSoon,
          ),
        ],
      ),
    );
  }
}
