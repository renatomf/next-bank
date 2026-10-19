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
    final colors = context.nbColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            'Minhas chaves cadastradas · ${keys.length} de $pixKeyLimit',
            style: NbType.sectionTitle.copyWith(color: colors.text),
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
                Text(
                  pixKey.type,
                  style: NbType.bodyStrong.copyWith(color: colors.text),
                ),
                Text(
                  pixKey.value,
                  style: NbType.caption.copyWith(color: colors.textMuted),
                ),
              ],
            ),
          ),
          _KeyAction(
            icon: Icons.copy_outlined,
            label: 'Copiar ${pixKey.type}',
            onPressed: sayComingSoon,
          ),
          _KeyAction(
            icon: Icons.ios_share,
            label: 'Compartilhar ${pixKey.type}',
            onPressed: sayComingSoon,
          ),
        ],
      ),
    );
  }
}

/// A plain icon button, read by screen readers as [label].
class _KeyAction extends StatelessWidget {
  const new({required this.icon, required this.label, required this.onPressed});

  final IconData icon;
  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    label: label,
    onTap: onPressed,
    excludeSemantics: true,
    child: IconButton(
      onPressed: onPressed,
      icon: Icon(icon, color: context.nbColors.text),
    ),
  );
}
