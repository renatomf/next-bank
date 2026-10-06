import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/home/domain/api_status.dart';
import 'package:next_bank/features/home/presentation/api_status_provider.dart';

import '../../../support/fake_api_status_repository.dart';

void main() {
  group('apiStatusProvider', () {
    test('exposes the status reported by the repository', () async {
      final repository = FakeApiStatusRepository(ApiStatus.available);
      final container = ProviderContainer(
        overrides: [apiStatusRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);

      expect(
        await container.read(apiStatusProvider.future),
        ApiStatus.available,
      );
    });

    test('checks again after being invalidated (retry)', () async {
      final repository = FakeApiStatusRepository(ApiStatus.unavailable);
      final container = ProviderContainer(
        overrides: [apiStatusRepositoryProvider.overrideWithValue(repository)],
      );
      addTearDown(container.dispose);
      final subscription = container.listen(apiStatusProvider, (_, _) {});
      addTearDown(subscription.close);

      expect(
        await container.read(apiStatusProvider.future),
        ApiStatus.unavailable,
      );
      repository.status = ApiStatus.available;
      container.invalidate(apiStatusProvider);

      expect(
        await container.read(apiStatusProvider.future),
        ApiStatus.available,
      );
      expect(repository.calls, 2);
    });
  });
}
