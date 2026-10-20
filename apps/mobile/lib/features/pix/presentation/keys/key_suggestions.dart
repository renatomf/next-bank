import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/features/pix/presentation/keys/example_pix_keys.dart';

/// "Cadastre também": the keys the customer could register, the CPF first
/// and recommended, then a field for other data. Every "Cadastrar" says it
/// is coming for now.
class KeySuggestions extends ConsumerWidget {
  /// Creates the suggestions.
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    // READ-02: the CPF only as the server masks it.
    final cpf = ref.watch(profileProvider).value?.cpfMasked ?? '';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: Text(
            'Cadastre também:',
            style: NbType.sectionTitle.copyWith(color: colors.text),
          ),
        ),
        const SizedBox(height: NbSpace.md),
        MenuGroup(
          children: [
            _SuggestionRow(
              pixKey: (icon: Icons.badge_outlined, type: 'CPF', value: cpf),
              recommended: true,
            ),
            const _SuggestionRow(pixKey: exampleEmailKey),
            const _SuggestionRow(pixKey: exampleRandomKey),
            const _OtherDataField(),
          ],
        ),
      ],
    );
  }
}

class _SuggestionRow extends StatelessWidget {
  const new({required this.pixKey, this.recommended = false});

  final ExamplePixKey pixKey;
  final bool recommended;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

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
                Wrap(
                  spacing: NbSpace.sm,
                  runSpacing: NbSpace.xs,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      pixKey.type,
                      style: NbType.bodyStrong.copyWith(color: colors.text),
                    ),
                    if (recommended) const _RecommendedBadge(),
                  ],
                ),
                Text(
                  pixKey.value,
                  style: NbType.caption.copyWith(color: colors.textMuted),
                ),
              ],
            ),
          ),
          const _RegisterButton(),
        ],
      ),
    );
  }
}

class _RecommendedBadge extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: NbSpace.sm, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: colors.accent),
        borderRadius: BorderRadius.circular(NbSpace.sm),
      ),
      child: Text(
        'Recomendada',
        style: NbType.cardLabel.copyWith(color: colors.accent),
      ),
    );
  }
}

/// "Cadastrar com outros dados": an e-mail or phone typed by the customer.
class _OtherDataField extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Padding(
      padding: const EdgeInsets.all(NbSpace.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Cadastrar com outros dados',
            style: NbType.bodyStrong.copyWith(color: colors.text),
          ),
          Text(
            'Digite um e-mail ou celular:',
            style: NbType.caption.copyWith(color: colors.textMuted),
          ),
          const SizedBox(height: NbSpace.md),
          const Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(hintText: 'Digite aqui'),
                ),
              ),
              SizedBox(width: NbSpace.sm),
              _RegisterButton(),
            ],
          ),
        ],
      ),
    );
  }
}

class _RegisterButton extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: () =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline),
    child: const Text('Cadastrar'),
  );
}
