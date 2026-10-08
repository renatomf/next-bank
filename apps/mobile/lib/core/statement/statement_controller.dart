import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_repository.dart';

/// Where the statement comes from. Bound to `HttpStatementRepository` by the
/// composition root (`main.dart`); tests override it with a fake.
final Provider<StatementRepository> statementRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// The statement as loaded so far.
final class StatementView {
  /// Creates the view.
  const new({
    required this.items,
    required this.nextCursor,
    this.loadingMore = false,
    this.loadMoreError,
  });

  /// The movements loaded, newest first.
  final List<StatementItem> items;

  /// The cursor of the next page; null at the end of the statement.
  final String? nextCursor;

  /// True while the next page is asked.
  final bool loadingMore;

  /// Why the next page could not be loaded.
  final String? loadMoreError;

  /// Whether older movements remain.
  bool get hasMore => nextCursor != null;

  /// The loaded movement [id], or null when it is not among them.
  StatementItem? itemById(String id) {
    for (final item in items) {
      if (item.id == id) return item;
    }
    return null;
  }
}

/// The statement shared by the Home and its own screens, loaded while one of
/// them is open: leaving them all, as the end of a Pix does, drops it, so it
/// comes back up to date. Not retried automatically: offline, the screen
/// offers "Tentar de novo".
final AsyncNotifierProvider<StatementController, StatementView>
statementProvider = AsyncNotifierProvider.autoDispose(
  StatementController.new,
  retry: (_, _) => null,
);

/// Pages through the statement, newest first (domain-model.md 8.1).
class StatementController extends AsyncNotifier<StatementView> {
  // Counts refreshes: a page asked before one belongs to a list that is gone.
  int _generation = 0;

  @override
  Future<StatementView> build() async {
    final first = await ref.read(statementRepositoryProvider).page();
    return StatementView(items: first.items, nextCursor: first.nextCursor);
  }

  /// Adds the next page. Ignored at the end, while a page is being asked,
  /// and before the first page is in.
  Future<void> loadMore() async {
    final view = state.value;
    final cursor = view?.nextCursor;
    if (view == null || cursor == null || view.loadingMore) return;
    final generation = _generation;
    state = AsyncData(
      StatementView(items: view.items, nextCursor: cursor, loadingMore: true),
    );
    try {
      final next = await ref.read(statementRepositoryProvider).page(cursor);
      if (!ref.mounted || generation != _generation) return;
      final shown = {for (final item in view.items) item.id};
      state = AsyncData(
        StatementView(
          items: [
            ...view.items,
            // The server never repeats one (T-DB-12); the app makes sure.
            ...next.items.where((item) => shown.add(item.id)),
          ],
          nextCursor: next.nextCursor,
        ),
      );
    } on ApiFailure catch (failure) {
      if (!ref.mounted || generation != _generation) return;
      state = AsyncData(
        StatementView(
          items: view.items,
          nextCursor: cursor,
          loadMoreError: messageFor(failure),
        ),
      );
    }
  }

  /// Loads the statement again from the newest movement.
  Future<void> refresh() async {
    _generation++;
    ref.invalidateSelf();
    await future;
  }
}
