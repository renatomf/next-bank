/// A bank a transfer by agency and account can go to (v1.1.0 plan, task
/// 4.9): its COMPE code, public, its name and the initials shown in place
/// of its logo, a third-party mark.
final class Bank {
  /// Creates the bank.
  const new({required this.code, required this.name, required this.initials});

  /// The three-digit COMPE code, e.g. "001".
  final String code;

  /// The name customers know it by.
  final String name;

  /// Two or three characters, e.g. "BB".
  final String initials;
}

/// The main banks, the best-known first, with their public codes.
const List<Bank> mainBanks = [
  Bank(code: '001', name: 'Banco do Brasil', initials: 'BB'),
  Bank(code: '237', name: 'Bradesco', initials: 'BR'),
  Bank(code: '341', name: 'Itaú Unibanco', initials: 'IT'),
  Bank(code: '104', name: 'Caixa Econômica Federal', initials: 'CE'),
  Bank(code: '033', name: 'Santander', initials: 'SA'),
  Bank(code: '260', name: 'Nubank', initials: 'NU'),
  Bank(code: '077', name: 'Banco Inter', initials: 'IN'),
  Bank(code: '336', name: 'C6 Bank', initials: 'C6'),
  Bank(code: '208', name: 'BTG Pactual', initials: 'BTG'),
  Bank(code: '102', name: 'XP Investimentos', initials: 'XP'),
  Bank(code: '323', name: 'Mercado Pago', initials: 'MP'),
  Bank(code: '380', name: 'PicPay', initials: 'PP'),
  Bank(code: '290', name: 'PagBank', initials: 'PB'),
  Bank(code: '756', name: 'Sicoob', initials: 'SC'),
  Bank(code: '748', name: 'Sicredi', initials: 'SI'),
  Bank(code: '041', name: 'Banrisul', initials: 'BRS'),
  Bank(code: '070', name: 'BRB', initials: 'BRB'),
  Bank(code: '422', name: 'Banco Safra', initials: 'SF'),
  Bank(code: '623', name: 'Banco Pan', initials: 'PAN'),
  Bank(code: '212', name: 'Banco Original', initials: 'OR'),
  Bank(code: '655', name: 'Banco BV', initials: 'BV'),
  Bank(code: '197', name: 'Stone', initials: 'ST'),
  Bank(code: '403', name: 'Cora', initials: 'CO'),
  Bank(code: '218', name: 'Banco BS2', initials: 'BS2'),
  Bank(code: '021', name: 'Banestes', initials: 'BE'),
  Bank(code: '004', name: 'Banco do Nordeste', initials: 'BN'),
  Bank(code: '003', name: 'Banco da Amazônia', initials: 'AM'),
  Bank(code: '389', name: 'Banco Mercantil', initials: 'ME'),
];

/// The [banks] whose name holds [query], whatever the case or accents, or
/// whose code starts with it; all of them, in order, for a blank query.
List<Bank> searchBanks(List<Bank> banks, String query) {
  final wanted = _plain(query.trim());
  if (wanted.isEmpty) return banks;
  return [
    for (final bank in banks)
      if (_plain(bank.name).contains(wanted) || bank.code.startsWith(wanted))
        bank,
  ];
}

/// [text] in lower case, without the accents of Portuguese.
String _plain(String text) {
  const accented = 'áàâãäéèêëíìîïóòôõöúùûüç';
  const plain = 'aaaaaeeeeiiiiooooouuuuc';
  final lower = text.toLowerCase();
  final buffer = StringBuffer();
  for (final char in lower.split('')) {
    final index = accented.indexOf(char);
    buffer.write(index < 0 ? char : plain[index]);
  }
  return buffer.toString();
}
