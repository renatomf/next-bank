import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_query.dart';
import 'package:next_bank/core/statement/statement_repository.dart';

/// A movement for tests: a Pix received from Mariana by default.
StatementItem movement(
  String id, {
  StatementKind kind = StatementKind.pixReceived,
  int amountCents = 35000,
  String? transferId,
}) => StatementItem(
  id: id,
  occurredAt: DateTime(2026, 10, 8, 9, 12),
  kind: kind,
  direction: kind == StatementKind.pixSent
      ? MoneyDirection.outgoing
      : MoneyDirection.incoming,
  amountCents: amountCents,
  counterparty: kind == StatementKind.demoFunding
      ? null
      : const StatementCounterparty(
          name: 'Mariana Costa',
          documentMasked: '***.456.789-**',
        ),
  transferId: transferId,
);

/// The statement without the API: [pages] answers each cursor (null for the
/// first page) and every cursor asked is recorded.
class FakeStatementRepository implements StatementRepository {
  /// Creates the fake; by default a single empty page.
  new([Map<String?, Future<StatementPage> Function()>? pages])
    : pages =
          pages ??
          {
            null: () async =>
                (items: const <StatementItem>[], nextCursor: null),
          };

  /// What each cursor answers.
  final Map<String?, Future<StatementPage> Function()> pages;

  /// Cursors asked, in order.
  final List<String?> cursors = [];

  /// The filter and search of each page asked, in order.
  final List<StatementQuery> queries = [];

  @override
  Future<StatementPage> page({
    String? cursor,
    StatementQuery query = allMovements,
  }) {
    cursors.add(cursor);
    queries.add(query);
    final answer = pages[cursor];
    if (answer == null) throw StateError('No page for cursor $cursor');
    return answer();
  }
}
