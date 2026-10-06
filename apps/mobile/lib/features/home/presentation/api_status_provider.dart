import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/api_client.dart';
import 'package:next_bank/features/home/data/http_api_status_repository.dart';
import 'package:next_bank/features/home/domain/api_status.dart';

/// Composition point: widgets depend on the domain interface,
/// never on the data layer.
final Provider<ApiStatusRepository> apiStatusRepositoryProvider = Provider(
  (ref) => HttpApiStatusRepository(ref.watch(apiProvider).getDefaultApi()),
);

/// Current API status; invalidate it to check again.
final FutureProvider<ApiStatus> apiStatusProvider = FutureProvider.autoDispose(
  (ref) => ref.watch(apiStatusRepositoryProvider).check(),
);
