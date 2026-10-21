import 'package:next_bank/core/date_texts.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

/// "quarta-feira, 30 de setembro de 2026, 14:09", in the customer's local
/// time: the date as the shared receipt writes it (v1.1.0 plan, task 1).
String receiptLongDate(DateTime instant) {
  final local = instant.toLocal();
  return '${weekdayName(local.weekday)}, ${local.day} de '
      '${longMonth(local.month)} de ${local.year}, ${clockTime(local)}';
}

/// The first letters of the first and last names, e.g. "MC" for "Mariana
/// Costa": how the receipt shows who receives.
String nameInitials(String name) {
  final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  if (words.isEmpty) return '';
  final first = words.first[0];
  final last = words.length > 1 ? words.last[0] : '';
  return (first + last).toUpperCase();
}

/// The payee's document as the server masked it; the app never sees more.
String payeeDetail(PixPayee payee) => 'CPF ${payee.documentMasked} · next bank';

/// The kind of transfer and key, e.g. "Pix · Chave CPF".
String pixType(PixKeyType keyType) => switch (keyType) {
  PixKeyType.cpf => 'Pix · Chave CPF',
  PixKeyType.email => 'Pix · Chave e-mail',
  PixKeyType.phone => 'Pix · Chave celular',
  PixKeyType.random => 'Pix · Chave aleatória',
};
