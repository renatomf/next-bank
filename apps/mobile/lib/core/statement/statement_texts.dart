import 'package:next_bank/core/date_texts.dart';
import 'package:next_bank/core/statement/statement_item.dart';

/// What moved the money, in the customer's words (domain-model.md 8.1).
String statementTitle(StatementKind kind) => switch (kind) {
  StatementKind.pixSent => 'Pix enviado',
  StatementKind.pixReceived => 'Pix recebido',
  StatementKind.demoFunding => 'Depósito inicial',
};

/// Who and when, as on the Home mockup: "Mariana Costa · Hoje, 09:12". Days
/// are counted on the customer's clock, [now].
String statementCaption(StatementItem item, DateTime now) {
  final when = movementTime(item.occurredAt, now);
  final counterparty = item.counterparty;
  return counterparty == null ? when : '${counterparty.name} · $when';
}

/// "Hoje, 09:12", "Ontem, 19:40", "5 out, 14:32" or "31 dez 2025, 23:05".
String movementTime(DateTime instant, DateTime now) {
  final local = instant.toLocal();
  final day = DateTime(local.year, local.month, local.day);
  final today = DateTime(now.year, now.month, now.day);
  final daysAgo = today.difference(day).inHours ~/ 24;
  final date = switch (daysAgo) {
    0 => 'Hoje',
    1 => 'Ontem',
    _ when local.year == now.year => '${local.day} ${shortMonth(local.month)}',
    _ => '${local.day} ${shortMonth(local.month)} ${local.year}',
  };
  return '$date, ${clockTime(local)}';
}
