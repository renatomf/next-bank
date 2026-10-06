import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/home/domain/api_status.dart';
import 'package:next_bank/features/home/presentation/api_status_provider.dart';
import 'package:next_bank/main.dart';

import 'fake_api_status_repository.dart';
import 'fake_auth_repository.dart';
import 'fake_token_store.dart';

/// The whole app, as main.dart builds it, over fakes.
Future<ProviderContainer> pumpApp(
  WidgetTester tester, {
  required FakeTokenStore store,
  FakeAuthRepository? repository,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(store),
        authRepositoryProvider.overrideWithValue(
          repository ?? FakeAuthRepository(tokens),
        ),
        randomProvider.overrideWithValue(Random(42)),
        apiStatusRepositoryProvider.overrideWithValue(
          FakeApiStatusRepository(ApiStatus.available),
        ),
      ],
      child: const NextBankApp(),
    ),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(tester.element(find.byType(NextBankApp)));
}
