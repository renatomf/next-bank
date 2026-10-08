/// What moved the money (domain-model.md 8.1).
enum StatementKind {
  /// A Pix the customer sent.
  pixSent,

  /// A Pix the customer received.
  pixReceived,

  /// The demo money the account opened with.
  demoFunding,
}

/// Whether the money came in or went out.
enum MoneyDirection {
  /// Into the account.
  incoming,

  /// Out of the account.
  outgoing,
}

/// The other side of a movement, as recorded when it happened.
final class StatementCounterparty {
  /// Creates the counterparty.
  const new({required this.name, required this.documentMasked});

  /// Full name.
  final String name;

  /// The document masked by the server, when there is one.
  final String? documentMasked;
}

/// One movement of the statement, read from the ledger by the server: what
/// shows here always matches the balance.
final class StatementItem {
  /// Creates the movement.
  const new({
    required this.id,
    required this.occurredAt,
    required this.kind,
    required this.direction,
    required this.amountCents,
    required this.counterparty,
    required this.transferId,
  });

  /// The posting's id.
  final String id;

  /// When the money moved.
  final DateTime occurredAt;

  /// What moved it.
  final StatementKind kind;

  /// In or out; the sign shown comes from here.
  final MoneyDirection direction;

  /// The amount in integer cents, always positive (ADR 0006).
  final int amountCents;

  /// The other side; none for the demo funding.
  final StatementCounterparty? counterparty;

  /// The Pix behind a Pix sent, to open its receipt (D3); null otherwise.
  final String? transferId;
}

/// One page of the statement and the cursor of the next, null at the end.
typedef StatementPage = ({List<StatementItem> items, String? nextCursor});
