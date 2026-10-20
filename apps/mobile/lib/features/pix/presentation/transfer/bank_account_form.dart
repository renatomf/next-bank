import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/domain/bank.dart';

/// The account at the picked bank: the bank with "Alterar", the agency and
/// the account with its digit. Layout only: "Continuar" says it is coming,
/// and nothing typed is sent or logged (MOB-02).
class BankAccountForm extends StatelessWidget {
  /// Creates the form for [bank].
  const new({required this.bank, required this.onChangeBank, super.key});

  /// The bank picked.
  final Bank bank;

  /// Back to the list of banks.
  final VoidCallback onChangeBank;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: NbSpace.lg,
      children: [
        Row(
          children: [
            InitialsAvatar(initials: bank.initials),
            const SizedBox(width: NbSpace.md),
            Expanded(
              child: Text(
                bank.name,
                style: NbType.bodyStrong.copyWith(color: colors.text),
              ),
            ),
            TextButton(onPressed: onChangeBank, child: const Text('Alterar')),
          ],
        ),
        const TextField(
          keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: 'Agência'),
        ),
        const TextField(
          keyboardType: TextInputType.number,
          decoration: InputDecoration(
            labelText: 'Conta e dígito',
            helperText: 'Para dígito X, utilize 0',
          ),
        ),
        PrimaryButton(
          label: 'Continuar',
          onPressed: () =>
              showNbToast(context, 'Em breve.', icon: Icons.info_outline),
        ),
      ],
    );
  }
}
