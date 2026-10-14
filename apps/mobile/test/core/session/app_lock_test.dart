import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/session/app_lock.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';
import 'package:next_bank/core/session/session_controller.dart';

import '../../support/fake_biometric_pin_store.dart';
import '../../support/fake_greeting_name_store.dart';
import '../../support/fake_monotonic_clock.dart';
import '../../support/fake_token_store.dart';

(ProviderContainer, FakeMonotonicClock, FakeWallClock) setUpLock() {
  final clock = FakeMonotonicClock();
  final wall = FakeWallClock();
  final container = ProviderContainer(
    overrides: [
      monotonicClockProvider.overrideWithValue(clock),
      wallClockProvider.overrideWithValue(wall),
      tokenStoreProvider.overrideWithValue(FakeTokenStore()),
      biometricPinStoreProvider.overrideWithValue(FakeBiometricPinStore()),
      greetingNameStoreProvider.overrideWithValue(FakeGreetingNameStore()),
    ],
  );
  addTearDown(container.dispose);
  container.listen(appLockProvider, (_, _) {});
  return (container, clock, wall);
}

bool locked(ProviderContainer container) => container.read(appLockProvider);

// The Unlock screen (F-16; PIX-06; domain-model.md 10; week 6 plan, D5): the
// app asks for the PIN when it opens with a stored session and after 5 minutes
// in the background; a login with the password does not.
void main() {
  group('AppLock', () {
    test(
      'starts locked: a session restored from the device asks for the PIN',
      () {
        final (container, _, _) = setUpLock();

        expect(locked(container), isTrue);
      },
    );

    test('unlocks once the PIN is verified', () {
      final (container, _, _) = setUpLock();

      container.read(appLockProvider.notifier).unlock();

      expect(locked(container), isFalse);
    });

    test('unlocks on a new sign-in: the password was just checked', () async {
      final (container, _, _) = setUpLock();
      await container.read(sessionProvider.future);

      await container.read(sessionProvider.notifier).signIn(tokens);

      expect(locked(container), isFalse);
    });

    test('stays unlocked after less than 5 minutes in the background', () {
      final (container, clock, _) = setUpLock();
      final lock = container.read(appLockProvider.notifier)
        ..unlock()
        ..paused();

      clock.current += const Duration(minutes: 4, seconds: 59);
      lock.resumed();

      expect(locked(container), isFalse);
    });

    test('locks after 5 minutes in the background (PIX-06)', () {
      final (container, clock, _) = setUpLock();
      final lock = container.read(appLockProvider.notifier)
        ..unlock()
        ..paused();

      clock.current += const Duration(minutes: 5);
      lock.resumed();

      expect(locked(container), isTrue);
    });

    test('counts each stay in the background from its own start', () {
      final (container, clock, _) = setUpLock();
      final lock = container.read(appLockProvider.notifier)
        ..unlock()
        ..paused();

      clock.current += const Duration(minutes: 3);
      lock.resumed();
      clock.current += const Duration(minutes: 10);
      lock
        ..paused()
        ..resumed();

      expect(locked(container), isFalse);
    });

    // F-21: the monotonic clock stops while the device sleeps; the device's
    // date keeps running, so hours asleep in the background still lock it.
    test(
      'locks after 5 minutes asleep, though the monotonic clock stopped',
      () {
        final (container, clock, wall) = setUpLock();
        final lock = container.read(appLockProvider.notifier)
          ..unlock()
          ..paused();

        clock.current += const Duration(seconds: 10);
        wall.current = wall.current.add(const Duration(hours: 3));
        lock.resumed();

        expect(locked(container), isTrue);
      },
    );

    // Moving the date back to dodge the lock locks it instead.
    test('locks when the device date moved back while in the background', () {
      final (container, clock, wall) = setUpLock();
      final lock = container.read(appLockProvider.notifier)
        ..unlock()
        ..paused();

      clock.current += const Duration(seconds: 10);
      wall.current = wall.current.subtract(const Duration(hours: 1));
      lock.resumed();

      expect(locked(container), isTrue);
    });

    test(
      'locks again when the session ends, for the next one restored',
      () async {
        final (container, _, _) = setUpLock();
        await container.read(sessionProvider.future);
        await container.read(sessionProvider.notifier).signIn(tokens);

        await container.read(sessionProvider.notifier).signOut();

        expect(locked(container), isTrue);
      },
    );
  });
}
