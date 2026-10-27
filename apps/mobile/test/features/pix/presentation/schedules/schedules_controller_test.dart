import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/pix/domain/pix_schedule.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/schedules/schedules_controller.dart';

import '../../../../support/fake_pix_schedule_repository.dart';

(ProviderContainer, FakePixScheduleRepository) setUpList({
  Future<PixSchedulePage> Function(String? cursor)? listAnswer,
}) {
  final repository = FakePixScheduleRepository();
  if (listAnswer != null) repository.listAnswer = listAnswer;
  final container = ProviderContainer(
    overrides: [pixScheduleRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  container.listen(schedulesProvider, (_, _) {});
  return (container, repository);
}

// The customer's scheduled Pix (v1.2.0 plan, task 7; D11), newest first,
// page by page as the server cuts them.
void main() {
  test('loads the first page', () async {
    final (container, repository) = setUpList();

    final view = await container.read(schedulesProvider.future);

    expect(view.items.single.id, 'schedule-1');
    expect(view.hasMore, isFalse);
    expect(repository.callsOf('list').single.cursor, isNull);
  });

  test('adds the next page from where the last ended', () async {
    final (container, repository) = setUpList(
      listAnswer: (cursor) async => cursor == null
          ? (items: [pixSchedule()], nextCursor: 'page-2')
          : (items: [pixSchedule(id: 'schedule-2')], nextCursor: null),
    );
    await container.read(schedulesProvider.future);

    await container.read(schedulesProvider.notifier).loadMore();

    final view = container.read(schedulesProvider).value!;
    expect(view.items.map((s) => s.id), ['schedule-1', 'schedule-2']);
    expect(view.hasMore, isFalse);
    expect(repository.callsOf('list').last.cursor, 'page-2');
  });

  test('keeps the page loaded and says why the next failed', () async {
    final (container, _) = setUpList(
      listAnswer: (cursor) async => cursor == null
          ? (items: [pixSchedule()], nextCursor: 'page-2')
          : throw const ApiUnreachable(),
    );
    await container.read(schedulesProvider.future);

    await container.read(schedulesProvider.notifier).loadMore();

    final view = container.read(schedulesProvider).value!;
    expect(view.items, hasLength(1));
    expect(view.hasMore, isTrue);
    expect(view.loadMoreError, 'Sem conexão. Tente de novo.');
  });

  test('loads nothing more at the end', () async {
    final (container, repository) = setUpList();
    await container.read(schedulesProvider.future);

    await container.read(schedulesProvider.notifier).loadMore();

    expect(repository.callsOf('list'), hasLength(1));
  });

  test('loads again from the newest on refresh', () async {
    final (container, repository) = setUpList();
    await container.read(schedulesProvider.future);

    await container.read(schedulesProvider.notifier).refresh();

    expect(repository.callsOf('list').map((c) => c.cursor), [null, null]);
  });
}
