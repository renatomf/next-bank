import 'package:flutter/material.dart';

/// Debit or credit.
enum CardKind {
  /// Pays from the account.
  debit,

  /// Pays on the invoice.
  credit,
}

/// One example card: its kind, its name, the last four digits and the area
/// of the glass art it shows.
typedef ExampleCard = ({
  CardKind kind,
  String label,
  String lastFour,
  Alignment artArea,
});

/// The customer's cards while they have no backend (v1.1.0 plan, task
/// 4.14): made-up last digits, never a full number.
const List<ExampleCard> exampleCards = [
  (
    kind: CardKind.debit,
    label: 'Débito',
    lastFour: '0001',
    artArea: Alignment.topRight,
  ),
  (
    kind: CardKind.credit,
    label: 'Crédito',
    lastFour: '0002',
    artArea: Alignment.bottomLeft,
  ),
];

/// The made-up pre-approved credit limit, in cents.
const int examplePreApprovedCents = 500000;

/// The made-up current invoice, in cents.
const int exampleInvoiceCents = 125040;

/// The made-up credit limit, in cents.
const int exampleCreditLimitCents = 500000;

/// The made-up invoice's due day.
const String exampleInvoiceDue = '10 nov';

/// One made-up purchase on the credit card.
typedef ExamplePurchase = ({String name, String date, int cents});

/// The made-up latest purchases.
const List<ExamplePurchase> examplePurchases = [
  (name: 'Streaming Exemplo', date: 'Hoje', cents: 3990),
  (name: 'Mercado Modelo', date: 'Ontem', cents: 15230),
  (name: 'Café Fictício', date: '17 out', cents: 1250),
];
