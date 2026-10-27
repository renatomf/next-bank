import 'package:dio/dio.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_money.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_query.dart';
import 'package:next_bank/core/statement/statement_repository.dart';
import 'package:nextbank_api/nextbank_api.dart' as api;

/// [StatementRepository] over the generated API client (ADR 0008). The client
/// refuses an unknown kind or direction; what it lets through that the server
/// never sends, such as a non-positive amount, a direction that contradicts
/// the kind, or a receipt link on anything but a Pix sent, spoils the page
/// (MASVS, code; READ-02).
class HttpStatementRepository implements StatementRepository {
  /// Creates the repository on top of the generated client.
  new(this._api);

  final api.DefaultApi _api;

  @override
  Future<StatementPage> page({
    String? cursor,
    StatementQuery query = allMovements,
  }) async {
    final api.Statement? statement;
    try {
      statement = (await _api.getMyStatement(
        cursor: cursor,
        filter: switch (query.filter) {
          null => null,
          StatementFilter.incoming => 'IN',
          StatementFilter.outgoing => 'OUT',
          StatementFilter.pix => 'PIX',
          StatementFilter.receipt => 'RECEIPT',
        },
        q: query.search,
      )).data;
    } on DioException catch (error) {
      throw apiFailureOf(error);
    }
    if (statement == null) throw const ApiUnexpected();
    return (
      items: [for (final item in statement.items) _itemOf(item)],
      nextCursor: statement.nextCursor,
    );
  }

  StatementItem _itemOf(api.StatementItem item) {
    final kind = switch (item.kind) {
      api.StatementItemKindEnum.PIX_SENT => StatementKind.pixSent,
      api.StatementItemKindEnum.PIX_RECEIVED => StatementKind.pixReceived,
      api.StatementItemKindEnum.DEMO_FUNDING => StatementKind.demoFunding,
      api.StatementItemKindEnum.TOP_UP => StatementKind.topUp,
      api.StatementItemKindEnum.PIX_REFUNDED => StatementKind.pixRefunded,
      // A kind a later API adds (A4): shown, without a link it cannot follow.
      api.StatementItemKindEnum.unknownDefaultOpenApi => StatementKind.other,
    };
    final direction = switch (item.direction) {
      api.StatementItemDirectionEnum.IN => MoneyDirection.incoming,
      api.StatementItemDirectionEnum.OUT => MoneyDirection.outgoing,
      api.StatementItemDirectionEnum.unknownDefaultOpenApi =>
        throw const ApiUnexpected(),
    };
    final known = kind != StatementKind.other;
    final sent = kind == StatementKind.pixSent;
    final leaves = sent || kind == StatementKind.topUp;
    // Only a Pix sent and a top-up go out; only a Pix sent or refunded links
    // to its Pix.
    final linksPix = sent || kind == StatementKind.pixRefunded;
    if (known && leaves != (direction == MoneyDirection.outgoing)) {
      throw const ApiUnexpected();
    }
    if (known && !linksPix && item.transferId != null) {
      throw const ApiUnexpected();
    }
    // Only a top-up links to a top-up receipt.
    if (known && kind != StatementKind.topUp && item.topUpId != null) {
      throw const ApiUnexpected();
    }
    final cents = reaisCentsOf(item.amount);
    if (cents <= 0) throw const ApiUnexpected();
    final counterparty = item.counterparty;
    return StatementItem(
      id: item.id,
      occurredAt: item.occurredAt,
      kind: kind,
      direction: direction,
      amountCents: cents,
      counterparty: counterparty == null
          ? null
          : StatementCounterparty(
              name: counterparty.name,
              documentMasked: counterparty.documentMasked,
            ),
      transferId: known ? item.transferId : null,
      topUpId: known ? item.topUpId : null,
    );
  }
}
