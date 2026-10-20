import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/presentation/transfer/bank_account_tab.dart';
import 'package:next_bank/features/pix/presentation/transfer/pix_key_tab.dart';

/// Transferir (v1.1.0 plan, task 4.9), layout only for now: a Pix by key
/// or contact, or a transfer by agency and account, picked by two pills.
/// Nothing is sent; the camera opens the QR Code reading, the other
/// actions say they are coming.
class TransferPixScreen extends StatefulWidget {
  /// Creates the screen; the router says where back and the camera go.
  const new({required this.onBack, required this.onScan, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  /// Opens the QR Code reading.
  final VoidCallback onScan;

  @override
  State<TransferPixScreen> createState() => _TransferPixScreenState();
}

class _TransferPixScreenState extends State<TransferPixScreen> {
  bool _byAccount = false;

  @override
  Widget build(BuildContext context) {
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
              const _TitleRow(),
              const SizedBox(height: NbSpace.lg),
              NbSurface(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // One row, each pill half the width and both as tall,
                    // however much a long label shrinks (S21 checkpoint).
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: NbSpace.sm,
                        children: [
                          Expanded(
                            child: FilterPill(
                              label: 'Chave Pix',
                              icon: Icons.key_outlined,
                              selected: !_byAccount,
                              onPressed: () =>
                                  setState(() => _byAccount = false),
                            ),
                          ),
                          Expanded(
                            child: FilterPill(
                              label: 'Agência e conta',
                              icon: Icons.account_balance_outlined,
                              selected: _byAccount,
                              onPressed: () =>
                                  setState(() => _byAccount = true),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: NbSpace.md),
                    const Divider(),
                    const SizedBox(height: NbSpace.md),
                    if (_byAccount)
                      const BankAccountTab()
                    else
                      PixKeyEntry(onScan: widget.onScan),
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

/// "Fazer Pix ou TED" on the start and "Limites de uso" on the end, apart,
/// on one row: each side shrinks its text to fit rather than break a line
/// (S21 checkpoint).
class _TitleRow extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      spacing: NbSpace.md,
      children: [
        Flexible(
          flex: 3,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            spacing: NbSpace.sm,
            children: [
              const PixMark(size: NbSize.icon),
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    'Fazer Pix ou TED',
                    maxLines: 1,
                    style: context.nbText.sectionTitle,
                  ),
                ),
              ),
            ],
          ),
        ),
        Flexible(
          flex: 2,
          child: FilledButton.tonal(
            onPressed: () =>
                showNbToast(context, 'Em breve.', icon: Icons.info_outline),
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: NbSpace.md),
              textStyle: context.nbText.caption.copyWith(
                fontWeight: FontWeight.w700,
              ),
            ),
            child: const FittedBox(
              fit: BoxFit.scaleDown,
              child: Text('Limites de uso', maxLines: 1),
            ),
          ),
        ),
      ],
    );
  }
}
