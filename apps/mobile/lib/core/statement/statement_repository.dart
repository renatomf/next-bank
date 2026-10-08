import 'package:next_bank/core/statement/statement_item.dart';

/// Reads the signed-in customer's statement from the API, newest first.
/// Failures are reported as `ApiFailure` with the catalog code.
abstract interface class StatementRepository {
  /// The page after [cursor], or the first page without one.
  Future<StatementPage> page([String? cursor]);
}
