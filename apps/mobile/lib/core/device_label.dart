import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

/// How the Security screen names a session's device, sent at sign-in (week 7
/// plan, D2). Only the system: the model or the system's version would need a
/// new dependency, and the list already shows when each session was used.
String? deviceLabelFor(String operatingSystem) => switch (operatingSystem) {
  'android' => 'Android',
  'ios' => 'iOS',
  _ => null,
};

/// This device's label; tests set it.
final Provider<String?> deviceLabelProvider = Provider(
  (ref) => deviceLabelFor(Platform.operatingSystem),
);
