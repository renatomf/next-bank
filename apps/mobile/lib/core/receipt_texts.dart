import 'package:next_bank/core/date_texts.dart';

// What every receipt writes the same way, the Pix's and the top-up's.

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

/// Shown on every receipt, on screen and in the shared image, so a demo
/// receipt cannot pass for a real payment (DEMO-05).
const String demoReceiptNotice =
    'Demonstração: o next bank é um projeto fictício; nenhum dinheiro real '
    'foi movimentado.';
