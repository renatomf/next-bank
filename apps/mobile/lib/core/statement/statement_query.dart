/// One way to narrow the statement (v1.1.0 plan, task 4.1).
enum StatementFilter {
  /// Money in.
  incoming,

  /// Money out.
  outgoing,

  /// Pix sent and received.
  pix,

  /// What has a receipt: the Pix sent.
  receipt,
}

/// What the statement screen asks: one filter at a time and part of a name,
/// both optional (X2).
typedef StatementQuery = ({StatementFilter? filter, String? search});

/// The whole statement, as the Home shows it.
const StatementQuery allMovements = (filter: null, search: null);
