import 'package:next_bank/core/session/app_lock.dart';

/// Time that only moves when the test says so, like the device's monotonic
/// clock: changing the device's date cannot move it, and it stops while the
/// device sleeps.
class FakeMonotonicClock implements MonotonicClock {
  /// Time since an arbitrary start.
  Duration current = Duration.zero;

  @override
  Duration elapsed() => current;
}

/// The device's date and time, which keeps running while it sleeps but can
/// be changed by whoever holds the phone.
class FakeWallClock implements WallClock {
  /// The date and time the device shows.
  DateTime current = DateTime.utc(2026, 10, 8, 12);

  @override
  DateTime now() => current;
}
