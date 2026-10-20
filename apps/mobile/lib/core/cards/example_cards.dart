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

/// The customer's cards while they have no backend (v1.1.0 plan, tasks 4.14
/// and 4.15), shown on the Home and the cards screen: made-up last digits,
/// never a full number.
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
