import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/home/domain/api_status.dart';

/// Repository behind the API status.
/// Bound to its implementation by the composition root (`main.dart`);
/// tests override it with a fake.
final Provider<ApiStatusRepository> apiStatusRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// Current API status; invalidate it to check again.
final FutureProvider<ApiStatus> apiStatusProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(apiStatusRepositoryProvider).check(),
);
