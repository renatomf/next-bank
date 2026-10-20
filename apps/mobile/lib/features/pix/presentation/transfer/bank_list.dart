import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/pix/domain/bank.dart';

/// "Buscar banco" and the main banks: ten at a time with "Carregar mais",
/// or every bank the search finds, by name or code.
class BankList extends StatefulWidget {
  /// Creates the list; [onSelected] gets the bank tapped.
  const new({required this.onSelected, super.key});

  /// Called with the bank the customer picks.
  final ValueChanged<Bank> onSelected;

  @override
  State<BankList> createState() => _BankListState();
}

class _BankListState extends State<BankList> {
  static const int _pageSize = 10;

  String _query = '';
  int _shown = _pageSize;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;
    final searching = _query.trim().isNotEmpty;
    final found = searchBanks(mainBanks, _query);
    // A search shows every bank it finds; the whole list pages.
    final banks = searching ? found : found.take(_shown).toList();
    final hasMore = !searching && _shown < found.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        NbSearchField(
          hint: 'Buscar banco',
          onChanged: (query) => setState(() => _query = query),
        ),
        const SizedBox(height: NbSpace.lg),
        if (banks.isEmpty)
          Text(
            'Nenhum banco encontrado.',
            style: context.nbText.bodyText.copyWith(color: colors.textMuted),
          )
        else
          MenuGroup(
            children: [
              for (final bank in banks)
                BankTile(bank: bank, onTap: () => widget.onSelected(bank)),
            ],
          ),
        if (hasMore)
          Padding(
            padding: const EdgeInsets.only(top: NbSpace.sm),
            child: TextButton(
              onPressed: () => setState(() => _shown += _pageSize),
              child: const Text('Carregar mais'),
            ),
          ),
      ],
    );
  }
}

/// One bank: its initials, its name and its code.
class BankTile extends StatelessWidget {
  /// Creates the row for [bank].
  const new({required this.bank, required this.onTap, super.key});

  /// The bank shown.
  final Bank bank;

  /// Picks the bank.
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      button: true,
      label: '${bank.name}, ${bank.code}',
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(NbSpace.lg),
          child: Row(
            children: [
              InitialsAvatar(initials: bank.initials),
              const SizedBox(width: NbSpace.md),
              Expanded(child: Text(bank.name, style: context.nbText.bodyText)),
              const SizedBox(width: NbSpace.sm),
              Text(
                bank.code,
                style: context.nbText.bodyText.copyWith(
                  color: colors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
