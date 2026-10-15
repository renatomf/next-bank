import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/statement/statement_controller.dart';
import 'package:next_bank/core/statement/statement_item.dart';
import 'package:next_bank/core/statement/statement_query.dart';

import '../../support/fake_statement_repository.dart';

Future<ProviderContainer> open(FakeStatementRepository repository) async {
  final container = ProviderContainer(
    overrides: [statementRepositoryProvider.overrideWithValue(repository)],
  );
  addTearDown(container.dispose);
  container.listen(statementProvider, (_, _) {});
  await container
      .read(statementProvider.future)
      .catchError(
        (Object _) => const StatementView(items: [], nextCursor: null),
      );
  return container;
}

StatementView viewOf(ProviderContainer container) =>
    container.read(statementProvider).requireValue;

StatementController controllerOf(ProviderContainer container) =>
    container.read(statementProvider.notifier);

List<String> idsOf(ProviderContainer container) =>
    viewOf(container).items.map((item) => item.id).toList();

StatementPage pageOf(List<String> ids, [String? nextCursor]) =>
    (items: [for (final id in ids) movement(id)], nextCursor: nextCursor);

// Screen 11 (domain-model.md 8.1 and 11): newest first, 20 a page, the next
// one by the cursor the server gave; the Home shows the same statement.
void main() {
  test('opens on the first page', () async {
    final repository = FakeStatementRepository({
      null: () async => pageOf(['a', 'b'], 'c1'),
    });

    final container = await open(repository);

    expect(repository.cursors, [null]);
    expect(idsOf(container), ['a', 'b']);
    expect(viewOf(container).hasMore, isTrue);
  });

  test('says when the first page cannot be loaded', () async {
    final repository = FakeStatementRepository({
      null: () async => throw const ApiUnreachable(),
    });

    final container = await open(repository);

    expect(container.read(statementProvider).error, isA<ApiUnreachable>());
  });

  test('adds the next page with the cursor the server gave', () async {
    final repository = FakeStatementRepository({
      null: () async => pageOf(['a', 'b'], 'c1'),
      'c1': () async => pageOf(['c', 'd']),
    });
    final container = await open(repository);

    await controllerOf(container).loadMore();

    expect(repository.cursors, [null, 'c1']);
    expect(idsOf(container), ['a', 'b', 'c', 'd']);
    expect(viewOf(container).hasMore, isFalse);
  });

  test('asks nothing past the end', () async {
    final repository = FakeStatementRepository({
      null: () async => pageOf(['a']),
    });
    final container = await open(repository);

    await controllerOf(container).loadMore();

    expect(repository.cursors, [null]);
  });

  test('asks one page at a time', () async {
    final next = Completer<StatementPage>();
    final repository = FakeStatementRepository({
      null: () async => pageOf(['a'], 'c1'),
      'c1': () => next.future,
    });
    final container = await open(repository);

    final first = controllerOf(container).loadMore();
    expect(viewOf(container).loadingMore, isTrue);
    final second = controllerOf(container).loadMore();
    next.complete(pageOf(['b']));
    await Future.wait([first, second]);

    expect(repository.cursors, [null, 'c1']);
    expect(viewOf(container).loadingMore, isFalse);
  });

  // T-DB-12 on the app side: the server never repeats an item across pages,
  // and the app would not show it twice anyway.
  test('never shows an item twice', () async {
    final repository = FakeStatementRepository({
      null: () async => pageOf(['a', 'b'], 'c1'),
      'c1': () async => pageOf(['b', 'c']),
    });
    final container = await open(repository);

    await controllerOf(container).loadMore();

    expect(idsOf(container), ['a', 'b', 'c']);
  });

  test('keeps what it has when the next page fails, and retries', () async {
    var fails = true;
    final repository = FakeStatementRepository({
      null: () async => pageOf(['a'], 'c1'),
      'c1': () async => fails ? throw const ApiUnreachable() : pageOf(['b']),
    });
    final container = await open(repository);

    await controllerOf(container).loadMore();
    expect(idsOf(container), ['a']);
    expect(viewOf(container).loadMoreError, 'Sem conexão. Tente de novo.');

    fails = false;
    await controllerOf(container).loadMore();
    expect(idsOf(container), ['a', 'b']);
    expect(viewOf(container).loadMoreError, isNull);
  });

  test('refreshes from the first page', () async {
    var first = ['a'];
    final repository = FakeStatementRepository({
      null: () async => pageOf(first),
    });
    final container = await open(repository);

    first = ['new', 'a'];
    await controllerOf(container).refresh();

    expect(idsOf(container), ['new', 'a']);
  });

  // A page asked before a refresh belongs to a list that no longer exists.
  test('drops a page that arrives after a refresh', () async {
    final stale = Completer<StatementPage>();
    var first = ['a'];
    final repository = FakeStatementRepository({
      null: () async => pageOf(first, 'c1'),
      'c1': () => stale.future,
    });
    final container = await open(repository);

    final loading = controllerOf(container).loadMore();
    first = ['new', 'a'];
    await controllerOf(container).refresh();
    stale.complete(pageOf(['old']));
    await loading;

    expect(idsOf(container), ['new', 'a']);
  });

  group('itemById', () {
    test('finds a loaded movement', () async {
      final repository = FakeStatementRepository({
        null: () async => pageOf(['a', 'b']),
      });
      final container = await open(repository);

      expect(viewOf(container).itemById('b')?.id, 'b');
    });

    test('is null for a movement not loaded', () async {
      final container = await open(FakeStatementRepository());

      expect(viewOf(container).itemById('zzz'), isNull);
    });
  });

  test('a Pix sent keeps the link to its receipt', () async {
    final repository = FakeStatementRepository({
      null: () async => (
        items: [
          movement('a', kind: StatementKind.pixSent, transferId: 'pix-1'),
        ],
        nextCursor: null,
      ),
    });

    final container = await open(repository);

    expect(viewOf(container).items.single.transferId, 'pix-1');
  });

  // The statement screen's own list (v1.1.0 plan, task 4.1): filtered on the
  // server, while the Home keeps the whole statement.
  group('filtered', () {
    StatementView filteredOf(ProviderContainer container) =>
        container.read(filteredStatementProvider).requireValue;

    Future<ProviderContainer> setUpFiltered(
      FakeStatementRepository repository,
    ) async {
      final container = ProviderContainer(
        overrides: [statementRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      container
        ..listen(filteredStatementProvider, (_, _) {})
        ..listen(statementProvider, (_, _) {});
      await container.read(filteredStatementProvider.future);
      await container.read(statementProvider.future);
      return container;
    }

    test("asks with the screen's filter and search", () async {
      final repository = FakeStatementRepository({
        null: () async => pageOf(['a']),
      });
      final container = await setUpFiltered(repository);

      container.read(statementQueryProvider.notifier)
        ..toggle(StatementFilter.incoming)
        ..search('  mari ');
      await container.read(filteredStatementProvider.future);

      expect(repository.queries.last, (
        filter: StatementFilter.incoming,
        search: 'mari',
      ));
      expect(filteredOf(container).items.map((item) => item.id), ['a']);
    });

    test('reloads from the first page when the filter changes', () async {
      final repository = FakeStatementRepository({
        null: () async => pageOf(['a'], 'c1'),
        'c1': () async => pageOf(['b']),
      });
      final container = await setUpFiltered(repository);
      await container.read(filteredStatementProvider.notifier).loadMore();

      container
          .read(statementQueryProvider.notifier)
          .toggle(StatementFilter.pix);
      await container.read(filteredStatementProvider.future);

      expect(repository.cursors.last, isNull);
      expect(filteredOf(container).items.map((item) => item.id), ['a']);
    });

    test('pages with the same filter', () async {
      final repository = FakeStatementRepository({
        null: () async => pageOf(['a'], 'c1'),
        'c1': () async => pageOf(['b']),
      });
      final container = await setUpFiltered(repository);
      container
          .read(statementQueryProvider.notifier)
          .toggle(StatementFilter.outgoing);
      await container.read(filteredStatementProvider.future);

      await container.read(filteredStatementProvider.notifier).loadMore();

      expect(repository.cursors.last, 'c1');
      expect(repository.queries.last.filter, StatementFilter.outgoing);
    });

    test("keeps the Home's statement whole", () async {
      final repository = FakeStatementRepository({
        null: () async => pageOf(['a']),
      });
      final container = await setUpFiltered(repository);

      container
          .read(statementQueryProvider.notifier)
          .toggle(StatementFilter.receipt);
      await container.read(filteredStatementProvider.future);
      container.invalidate(statementProvider);
      await container.read(statementProvider.future);

      expect(repository.queries.last, allMovements);
    });
  });

  // One filter at a time (X2); a search of fewer than two letters is none.
  group('the query', () {
    StatementQuery queryOf(ProviderContainer container) =>
        container.read(statementQueryProvider);

    ProviderContainer setUpQuery() {
      final container = ProviderContainer();
      addTearDown(container.dispose);
      container.listen(statementQueryProvider, (_, _) {});
      return container;
    }

    test('starts with the whole statement', () {
      expect(queryOf(setUpQuery()), allMovements);
    });

    test('takes one filter at a time, and clears it on a second tap', () {
      final container = setUpQuery();
      final query = container.read(statementQueryProvider.notifier)
        ..toggle(StatementFilter.incoming)
        ..toggle(StatementFilter.pix);

      expect(queryOf(container).filter, StatementFilter.pix);

      query.toggle(StatementFilter.pix);

      expect(queryOf(container).filter, isNull);
    });

    test('searches the trimmed text, and nothing under two letters', () {
      final container = setUpQuery();
      final query = container.read(statementQueryProvider.notifier)
        ..search('  ma  ');

      expect(queryOf(container).search, 'ma');

      query.search(' m ');

      expect(queryOf(container).search, isNull);
    });
  });
}
