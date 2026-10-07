import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/home/domain/api_status.dart';
import 'package:next_bank/features/home/presentation/api_status_provider.dart';
import 'package:next_bank/main.dart';

import 'fake_api_status_repository.dart';
import 'fake_auth_repository.dart';
import 'fake_profile_repository.dart';
import 'fake_token_store.dart';

/// The whole app, as main.dart builds it, over fakes. By default the
/// account already has its PIN; pass a [profile] without it to test the
/// registration.
Future<ProviderContainer> pumpApp(
  WidgetTester tester, {
  required FakeTokenStore store,
  FakeAuthRepository? repository,
  FakeProfileRepository? profile,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        tokenStoreProvider.overrideWithValue(store),
        authRepositoryProvider.overrideWithValue(
          repository ?? FakeAuthRepository(tokens),
        ),
        profileRepositoryProvider.overrideWithValue(
          profile ?? FakeProfileRepository(),
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
