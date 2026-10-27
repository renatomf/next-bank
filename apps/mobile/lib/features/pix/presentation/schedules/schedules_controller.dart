import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/api_messages.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';

/// The scheduled Pix as loaded so far.
final class SchedulesView {
  /// Creates the view.
  const new({
    required this.items,
    required this.nextCursor,
    this.loadingMore = false,
    this.loadMoreError,
  });

  /// The schedules loaded, newest first.
  final List<PixSchedule> items;

  /// The cursor of the next page; null at the end.
  final String? nextCursor;

  /// True while the next page is asked.
  final bool loadingMore;

  /// Why the next page could not be loaded.
  final String? loadMoreError;

  /// Whether older schedules remain.
  bool get hasMore => nextCursor != null;
}

/// The customer's scheduled Pix, loaded while their screen is open, so they
/// come back up to date. Not retried automatically: offline, the screen
/// offers "Tentar de novo".
final AsyncNotifierProvider<SchedulesController, SchedulesView>
schedulesProvider = AsyncNotifierProvider.autoDispose(
  SchedulesController.new,
  retry: (_, _) => null,
);

/// Pages through the scheduled Pix, newest first (v1.2.0 plan, task 7).
class SchedulesController extends AsyncNotifier<SchedulesView> {
  // Counts refreshes: a page asked before one belongs to a list that is gone.
  int _generation = 0;

  @override
  Future<SchedulesView> build() async {
    final first = await ref.read(pixScheduleRepositoryProvider).list();
    return SchedulesView(items: first.items, nextCursor: first.nextCursor);
  }

  /// Adds the next page. Ignored at the end, while a page is being asked,
  /// and before the first page is in.
  Future<void> loadMore() async {
    final view = state.value;
    final cursor = view?.nextCursor;
    if (view == null || cursor == null || view.loadingMore) return;
    final generation = _generation;
    state = AsyncData(
      SchedulesView(items: view.items, nextCursor: cursor, loadingMore: true),
    );
    try {
      final next = await ref
          .read(pixScheduleRepositoryProvider)
          .list(cursor: cursor);
      if (!ref.mounted || generation != _generation) return;
      final shown = {for (final item in view.items) item.id};
      state = AsyncData(
        SchedulesView(
          // The server never repeats one; the app makes sure.
          items: [...view.items, ...next.items.where((s) => shown.add(s.id))],
          nextCursor: next.nextCursor,
        ),
      );
    } on ApiFailure catch (failure) {
      if (!ref.mounted || generation != _generation) return;
      state = AsyncData(
        SchedulesView(
          items: view.items,
          nextCursor: cursor,
          loadMoreError: messageFor(failure),
        ),
      );
    }
  }

  /// Loads the schedules again from the newest.
  Future<void> refresh() async {
    _generation++;
    ref.invalidateSelf();
    await future;
  }
}
