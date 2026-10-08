import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// Time since an arbitrary start that only moves forward: changing the
/// device's date cannot move it. It stops while the device sleeps, which is
/// why the lock also reads a [WallClock] (F-21).
abstract interface class MonotonicClock {
  /// Time since the clock started.
  Duration elapsed();
}

/// [MonotonicClock] over a [Stopwatch], which reads the platform's monotonic
/// clock.
class StopwatchClock implements MonotonicClock {
  final Stopwatch _stopwatch = Stopwatch()..start();

  @override
  Duration elapsed() => _stopwatch.elapsed;
}

/// The device's date and time: it keeps running while the device sleeps, but
/// whoever holds the phone can change it.
abstract interface class WallClock {
  /// The date and time the device shows.
  DateTime now();
}

/// [WallClock] over [DateTime.now].
class SystemWallClock implements WallClock {
  @override
  DateTime now() => DateTime.now();
}

/// The clocks the lock measures with; tests override them with fakes.
final Provider<MonotonicClock> monotonicClockProvider = Provider(
  (ref) => StopwatchClock(),
);

/// See [monotonicClockProvider].
final Provider<WallClock> wallClockProvider = Provider(
  (ref) => SystemWallClock(),
);

/// Whether the app asks for the PIN before showing anything of the account.
final NotifierProvider<AppLock, bool> appLockProvider = NotifierProvider(
  AppLock.new,
);

/// The Unlock screen's rule (F-16; PIX-06; domain-model.md 10; week 6 plan,
/// D5): locked when the app opens with a stored session and after 5 minutes
/// in the background; unlocked by the PIN checked on the server or by a new
/// sign-in, since the password was just checked.
class AppLock extends Notifier<bool> {
  /// Time in the background after which the PIN is asked again.
  static const Duration backgroundLimit = Duration(minutes: 5);

  Duration? _pausedAt;
  DateTime? _pausedOn;

  @override
  bool build() {
    ref.listen(sessionProvider, (previous, next) {
      switch ((previous, next)) {
        // A session that ends locks the app for the next one restored.
        case (_, AsyncData(value: SignedOut())):
          state = true;
        // Signed in with the password just now, not restored from the device.
        case (AsyncData(value: SignedOut()), AsyncData(value: SignedIn())):
          state = false;
        case _:
          break;
      }
    });
    return true;
  }

  /// The PIN was accepted, or the customer signed in with the password.
  void unlock() => state = false;

  /// The app went to the background.
  void paused() {
    _pausedAt = ref.read(monotonicClockProvider).elapsed();
    _pausedOn = ref.read(wallClockProvider).now();
  }

  /// The app came back: locked again after [backgroundLimit] by either clock.
  /// The monotonic one cannot be moved but stops while the device sleeps; the
  /// date keeps running asleep but can be changed, so a date that went back
  /// locks too (F-21).
  void resumed() {
    final pausedAt = _pausedAt;
    final pausedOn = _pausedOn;
    _pausedAt = null;
    _pausedOn = null;
    if (pausedAt == null || pausedOn == null) return;
    final awake = ref.read(monotonicClockProvider).elapsed() - pausedAt;
    final onTheDate = ref.read(wallClockProvider).now().difference(pausedOn);
    if (awake >= backgroundLimit ||
        onTheDate >= backgroundLimit ||
        onTheDate.isNegative) {
      state = true;
    }
  }
}
