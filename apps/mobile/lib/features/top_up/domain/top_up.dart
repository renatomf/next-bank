/// A phone operator a top-up goes to, as the API lists it (D6): made up,
/// never a real carrier's mark, with its initials in place of a logo.
final class TopUpOperator {
  /// Creates the operator.
  const new({
    required this.id,
    required this.name,
    required this.initials,
    required this.amountsCents,
  });

  /// The id the server knows it by.
  final String id;

  /// The name shown.
  final String name;

  /// Two letters, shown in place of a logo.
  final String initials;

  /// The amounts it offers, in integer cents, in the server's order.
  final List<int> amountsCents;
}

/// A top-up done, as its receipt shows it (READ-02): the number only masked.
final class TopUp {
  /// Creates the top-up.
  const new({
    required this.id,
    required this.operatorName,
    required this.operatorInitials,
    required this.phoneMasked,
    required this.amountCents,
    required this.createdAt,
  });

  /// The top-up's id, to read its receipt again.
  final String id;

  /// Who it went to.
  final String operatorName;

  /// Shown in place of the operator's logo.
  final String operatorInitials;

  /// The number recharged, e.g. "(11) *****-0001".
  final String phoneMasked;

  /// The amount in integer cents, always positive (ADR 0006).
  final int amountCents;

  /// When the server took it.
  final DateTime createdAt;
}
