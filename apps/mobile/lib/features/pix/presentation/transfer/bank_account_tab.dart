import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/domain/bank.dart';
import 'package:next_bank/features/pix/presentation/transfer/bank_account_form.dart';
import 'package:next_bank/features/pix/presentation/transfer/bank_list.dart';

/// The Agência e conta tab: the list of banks until one is picked, then
/// the account form for it, whose "Alterar" brings the list back.
class BankAccountTab extends StatefulWidget {
  /// Creates the tab.
  const new({super.key});

  @override
  State<BankAccountTab> createState() => _BankAccountTabState();
}

class _BankAccountTabState extends State<BankAccountTab> {
  Bank? _bank;

  @override
  Widget build(BuildContext context) {
    final bank = _bank;
    if (bank == null) {
      return BankList(onSelected: (picked) => setState(() => _bank = picked));
    }
    return BankAccountForm(
      bank: bank,
      onChangeBank: () => setState(() => _bank = null),
    );
  }
}
