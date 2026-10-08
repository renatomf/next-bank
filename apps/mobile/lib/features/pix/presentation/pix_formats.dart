import 'package:next_bank/core/date_texts.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

/// "5 out 2026 · 14:32", in the customer's local time (comprovante-dark).
String receiptDate(DateTime instant) {
  final local = instant.toLocal();
  return '${local.day} ${shortMonth(local.month)} ${local.year} · '
      '${clockTime(local)}';
}

/// The payer's account with only its last four digits (brief, section 7).
String payerDetail({required String branch, required String number}) {
  final digits = number.replaceAll(RegExp(r'\D'), '');
  final lastFour = digits.substring(digits.length - 4);
  return 'next bank · Ag $branch · CC •••• $lastFour';
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
