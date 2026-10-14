import 'package:flutter_riverpod/misc.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/greeting_name_store.dart';

import 'fake_biometric_pin_store.dart';
import 'fake_greeting_name_store.dart';

/// What the device keeps besides the session, empty and without biometrics:
/// for tests whose session or profile reaches them (v1.1.0 plan, task 2).
List<Override> deviceStoreOverrides() => [
  biometricPinStoreProvider.overrideWithValue(
    FakeBiometricPinStore(available: false),
  ),
  greetingNameStoreProvider.overrideWithValue(FakeGreetingNameStore()),
];
