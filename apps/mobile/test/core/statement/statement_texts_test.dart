import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_texts.dart';

StatementItem item({
  StatementKind kind = StatementKind.pixReceived,
  DateTime? occurredAt,
  StatementCounterparty? counterparty = const StatementCounterparty(
    name: 'Mariana Costa',
    documentMasked: '***.456.789-**',
  ),
}) => StatementItem(
  id: 'posting-1',
  occurredAt: occurredAt ?? DateTime(2026, 10, 8, 9, 12),
  kind: kind,
  direction: kind == StatementKind.pixSent
      ? MoneyDirection.outgoing
      : MoneyDirection.incoming,
  amountCents: 35000,
  counterparty: counterparty,
  transferId: null,
);

// How a movement reads on the Home and the statement (home-dark mockup;
// domain-model.md 8.1).
void main() {
  final now = DateTime(2026, 10, 8, 18);

  group('statementTitle', () {
    for (final (kind, title) in [
      (StatementKind.pixSent, 'Pix enviado'),
      (StatementKind.pixReceived, 'Pix recebido'),
      (StatementKind.demoFunding, 'Depósito inicial'),
      (StatementKind.topUp, 'Recarga de celular'),
    ]) {
      test(kind.name, () {
        expect(statementTitle(kind), title);
      });
    }
  });

  group('statementCaption', () {
    test('who and "Hoje" for a movement of today', () {
      expect(statementCaption(item(), now), 'Mariana Costa · Hoje, 09:12');
    });

    test('"Ontem" for a movement of yesterday', () {
      expect(
        statementCaption(item(occurredAt: DateTime(2026, 10, 7, 19, 40)), now),
        'Mariana Costa · Ontem, 19:40',
      );
    });

    test('the day and month for an older movement of this year', () {
      expect(
        statementCaption(item(occurredAt: DateTime(2026, 10, 5, 14, 32)), now),
        'Mariana Costa · 5 out, 14:32',
      );
    });

    test('the year for a movement of another year', () {
      expect(
        statementCaption(item(occurredAt: DateTime(2025, 12, 31, 23, 5)), now),
        'Mariana Costa · 31 dez 2025, 23:05',
      );
    });

    // Midnight belongs to the new day, in the customer's clock.
    test('"Ontem" across midnight', () {
      expect(
        statementCaption(
          item(occurredAt: DateTime(2026, 10, 7, 23, 59)),
          DateTime(2026, 10, 8, 0, 1),
        ),
        'Mariana Costa · Ontem, 23:59',
      );
    });

    test('only the time when nobody is on the other side', () {
      expect(
        statementCaption(
          item(kind: StatementKind.demoFunding, counterparty: null),
          now,
        ),
        'Hoje, 09:12',
      );
    });

    // The server sends UTC; the customer reads their own clock.
    test('reads a UTC instant in local time', () {
      final instant = DateTime.utc(2026, 10, 8, 12, 12);

      expect(
        statementCaption(item(occurredAt: instant), now),
        statementCaption(item(occurredAt: instant.toLocal()), now),
      );
    });
  });
}
