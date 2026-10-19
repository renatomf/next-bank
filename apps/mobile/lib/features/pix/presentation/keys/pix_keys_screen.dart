import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/presentation/keys/example_pix_keys.dart';
import 'package:next_bank/features/pix/presentation/keys/key_suggestions.dart';
import 'package:next_bank/features/pix/presentation/keys/registered_keys.dart';

/// Minhas chaves (v1.1.0 plan, task 4.8), layout only for now: the
/// registered keys and the ones the customer could register, with made-up
/// values. Every action says it is coming.
class PixKeysScreen extends StatelessWidget {
  /// Creates the screen; the router says where back goes.
  const new({required this.onBack, super.key});

  /// Leaves the screen.
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
              ScreenHeader(
                title: 'Minhas chaves',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
                // On the right edge; wraps on a small phone with large text.
                action: Flexible(
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: TextButton(
                      onPressed: () => showNbToast(
                        context,
                        'Em breve.',
                        icon: Icons.info_outline,
                      ),
                      child: const Text('Selecionar'),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: NbSpace.xl),
              Text(
                'Cadastre suas chaves Pix e concentre todas as transações em '
                'um só lugar',
                style: NbType.screenTitle.copyWith(color: colors.text),
              ),
              const SizedBox(height: NbSpace.xl),
              const RegisteredKeys(keys: exampleRegisteredKeys),
              const SizedBox(height: NbSpace.xl),
              const KeySuggestions(),
            ],
          ),
        ),
      ),
    );
  }
}
