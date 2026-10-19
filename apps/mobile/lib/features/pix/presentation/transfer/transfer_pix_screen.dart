import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/presentation/transfer/bank_account_tab.dart';
import 'package:next_bank/features/pix/presentation/transfer/pix_key_tab.dart';

/// Transferir (v1.1.0 plan, task 4.9), layout only for now: a Pix by key
/// or contact, or a transfer by agency and account, picked by two pills.
/// Nothing is sent; the actions say they are coming.
class TransferPixScreen extends StatefulWidget {
  /// Creates the screen; the router says where back goes.
  const new({required this.onBack, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  @override
  State<TransferPixScreen> createState() => _TransferPixScreenState();
}

class _TransferPixScreenState extends State<TransferPixScreen> {
  bool _byAccount = false;

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
                title: 'Transferir',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              Row(
                children: [
                  const PixMark(size: NbSize.icon),
                  const SizedBox(width: NbSpace.sm),
                  Expanded(
                    child: Text(
                      'Fazer Pix ou TED',
                      style: NbType.sectionTitle.copyWith(color: colors.text),
                    ),
                  ),
                  // Wraps on a small phone with large text.
                  Flexible(
                    child: FilledButton.tonal(
                      onPressed: () => showNbToast(
                        context,
                        'Em breve.',
                        icon: Icons.info_outline,
                      ),
                      child: const Text('Limites de uso'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: NbSpace.lg),
              Container(
                padding: const EdgeInsets.all(NbSpace.lg),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(NbRadius.box),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Wrap(
                      spacing: NbSpace.sm,
                      runSpacing: NbSpace.sm,
                      children: [
                        FilterPill(
                          label: 'Chave Pix',
                          icon: Icons.key_outlined,
                          selected: !_byAccount,
                          onPressed: () => setState(() => _byAccount = false),
                        ),
                        FilterPill(
                          label: 'Agência e conta',
                          icon: Icons.account_balance_outlined,
                          selected: _byAccount,
                          onPressed: () => setState(() => _byAccount = true),
                        ),
                      ],
                    ),
                    const SizedBox(height: NbSpace.md),
                    Divider(height: 1, color: colors.border),
                    const SizedBox(height: NbSpace.md),
                    if (_byAccount)
                      const BankAccountTab()
                    else
                      const PixKeyEntry(),
                  ],
                ),
              ),
              if (!_byAccount) ...[
                const SizedBox(height: NbSpace.xl),
                const PixContacts(),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
