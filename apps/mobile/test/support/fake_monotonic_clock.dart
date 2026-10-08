import 'package:next_bank/core/session/app_lock.dart';

/// Time that only moves when the test says so, like the device's monotonic
/// clock: changing the device's date cannot move it.
class FakeMonotonicClock implements MonotonicClock {
  /// Time since an arbitrary start.
  Duration current = Duration.zero;

  @override
  Duration elapsed() => current;
}
