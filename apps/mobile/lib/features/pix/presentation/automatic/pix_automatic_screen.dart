import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/core/ui/example_tag.dart';
import 'package:next_bank/features/pix/presentation/automatic/automatic_payment_sheet.dart';
import 'package:next_bank/features/pix/presentation/automatic/automatic_payment_tile.dart';
import 'package:next_bank/features/pix/presentation/automatic/example_automatic_payments.dart';

/// Pix Automático (v1.1.0 plan, task 4.7), layout only for now: the
/// registered accounts, each opening its details in a sheet. Registering
/// and help say they are coming.
class PixAutomaticScreen extends StatelessWidget {
  /// Creates the screen; the router says where back goes.
  const new({required this.onBack, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    void sayComingSoon() =>
        showNbToast(context, 'Em breve.', icon: Icons.info_outline);

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Pix Automático',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: onBack,
                action: IconCircleButton(
                  icon: Icons.help_outline,
                  label: 'Ajuda',
                  onPressed: sayComingSoon,
                ),
              ),
              const SizedBox(height: NbSpace.xl),
              Text(
                'Gerencie suas contas no Pix Automático',
                style: context.nbText.screenTitle,
              ),
              const SizedBox(height: NbSpace.lg),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton.tonalIcon(
                  onPressed: sayComingSoon,
                  icon: const Icon(Icons.add_circle_outline),
                  label: const Text('Cadastrar nova conta'),
                  iconAlignment: IconAlignment.end,
                ),
              ),
              const SizedBox(height: NbSpace.xl),
              Row(
                spacing: NbSpace.md,
                children: [
                  Icon(Icons.check_circle_outline, color: colors.success),
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        'Cadastradas',
                        style: context.nbText.sectionTitle,
                      ),
                    ),
                  ),
                  const ExampleTag(),
                ],
              ),
              const SizedBox(height: NbSpace.sm),
              for (final payment in exampleAutomaticPayments)
                AutomaticPaymentTile(
                  payment: payment,
                  onTap: () => showAutomaticPaymentSheet(context, payment),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
