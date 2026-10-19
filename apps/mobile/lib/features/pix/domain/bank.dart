/// A bank a transfer by agency and account can go to (v1.1.0 plan, task
/// 4.9): its COMPE code, public, and its name.
final class Bank {
  /// Creates the bank.
  const new({required this.code, required this.name});

  /// The three-digit COMPE code, e.g. "001".
  final String code;

  /// The name customers know it by.
  final String name;
}

/// The main banks, the best-known first, with their public codes.
const List<Bank> mainBanks = [
  Bank(code: '001', name: 'Banco do Brasil'),
  Bank(code: '237', name: 'Bradesco'),
  Bank(code: '341', name: 'Itaú Unibanco'),
  Bank(code: '104', name: 'Caixa Econômica Federal'),
  Bank(code: '033', name: 'Santander'),
  Bank(code: '260', name: 'Nubank'),
  Bank(code: '077', name: 'Banco Inter'),
  Bank(code: '336', name: 'C6 Bank'),
  Bank(code: '208', name: 'BTG Pactual'),
  Bank(code: '102', name: 'XP Investimentos'),
  Bank(code: '323', name: 'Mercado Pago'),
  Bank(code: '380', name: 'PicPay'),
  Bank(code: '290', name: 'PagBank'),
  Bank(code: '756', name: 'Sicoob'),
  Bank(code: '748', name: 'Sicredi'),
  Bank(code: '041', name: 'Banrisul'),
  Bank(code: '070', name: 'BRB'),
  Bank(code: '422', name: 'Banco Safra'),
  Bank(code: '623', name: 'Banco Pan'),
  Bank(code: '212', name: 'Banco Original'),
  Bank(code: '655', name: 'Banco BV'),
  Bank(code: '197', name: 'Stone'),
  Bank(code: '403', name: 'Cora'),
  Bank(code: '218', name: 'Banco BS2'),
  Bank(code: '021', name: 'Banestes'),
  Bank(code: '004', name: 'Banco do Nordeste'),
  Bank(code: '003', name: 'Banco da Amazônia'),
  Bank(code: '389', name: 'Banco Mercantil'),
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
