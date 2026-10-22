import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/domain/top_up_repository.dart';

/// Where top-ups go. Bound to `HttpTopUpRepository` by the composition root
/// (`main.dart`); tests override it with a fake.
final Provider<TopUpRepository> topUpRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// The operators and their amounts, as the server lists them (D6). Not
/// retried automatically: offline, the screen offers "Tentar de novo".
final FutureProvider<List<TopUpOperator>> topUpOperatorsProvider =
    FutureProvider.autoDispose(
      (ref) => ref.watch(topUpRepositoryProvider).operators(),
      retry: (_, _) => null,
    );

/// The receipt of one top-up, read from the server while it is shown.
final FutureProvider<TopUp> Function(String) topUpProvider = FutureProvider
    .autoDispose
    .family<TopUp, String>(
      (ref, topUpId) => ref.watch(topUpRepositoryProvider).fetch(topUpId),
      retry: (_, _) => null,
    );
