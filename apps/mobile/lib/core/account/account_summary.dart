/// The customer's account as the Home shows it. The balance is the server's:
/// the app never computes one (roadmap, section 6.7).
final class AccountSummary {
  /// Creates the summary.
  const new({
    required this.branch,
    required this.number,
    required this.availableBalanceCents,
  });

  /// Branch, e.g. "0001".
  final String branch;

  /// Account number with its check digit, e.g. "100000-4".
  final String number;

  /// Available balance in integer cents; money is never a double (ADR 0006).
  final int availableBalanceCents;
}
