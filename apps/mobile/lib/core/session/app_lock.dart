import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// Time since an arbitrary start that only moves forward: changing the
/// device's date or time zone cannot move it, so it cannot cut the time in
/// the background short.
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

/// The clock the lock measures with; tests override it with a fake.
final Provider<MonotonicClock> monotonicClockProvider = Provider(
  (ref) => StopwatchClock(),
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
  void paused() => _pausedAt = ref.read(monotonicClockProvider).elapsed();

  /// The app came back: locked again after [backgroundLimit].
  void resumed() {
    final pausedAt = _pausedAt;
    _pausedAt = null;
    if (pausedAt == null) return;
    final away = ref.read(monotonicClockProvider).elapsed() - pausedAt;
    if (away >= backgroundLimit) state = true;
  }
}
