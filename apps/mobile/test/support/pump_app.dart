import 'dart:math';

import 'package:design_system/design_system.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/account/account_providers.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/session_controller.dart';
import 'package:next_bank/features/auth/presentation/auth_providers.dart';
import 'package:next_bank/features/unlock/presentation/unlock_providers.dart';
import 'package:next_bank/main.dart';

import 'fake_account_repository.dart';
import 'fake_auth_repository.dart';
import 'fake_monotonic_clock.dart';
import 'fake_profile_repository.dart';
import 'fake_token_store.dart';
import 'fake_unlock_repository.dart';

/// The whole app, as main.dart builds it, over fakes. By default the
/// account already has its PIN; pass a [profile] without it to test the
/// registration. A stored session opens on the Unlock screen.
Future<ProviderContainer> pumpApp(
  WidgetTester tester, {
  required FakeTokenStore store,
  FakeAuthRepository? repository,
  FakeProfileRepository? profile,
  FakeAccountRepository? account,
  FakeUnlockRepository? unlock,
  FakeMonotonicClock? clock,
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
        accountRepositoryProvider.overrideWithValue(
          account ?? FakeAccountRepository(),
        ),
        unlockRepositoryProvider.overrideWithValue(
          unlock ?? FakeUnlockRepository(),
        ),
        monotonicClockProvider.overrideWithValue(clock ?? FakeMonotonicClock()),
        randomProvider.overrideWithValue(Random(42)),
      ],
      child: const NextBankApp(),
    ),
  );
  await tester.pumpAndSettle();
  return ProviderScope.containerOf(tester.element(find.byType(NextBankApp)));
}

/// Types the PIN on the Unlock screen, as the customer does on opening.
Future<void> unlockWithPin(WidgetTester tester, [String pin = '2580']) async {
  await tester.enterText(find.byType(PinField), pin);
  await tester.pumpAndSettle();
}
