import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The device's clock, for the greeting only (no business rule depends on
/// it); tests set the hour.
final Provider<DateTime Function()> nowProvider = Provider(
  (ref) => DateTime.now,
);

/// "Bom dia" before noon, "Boa tarde" before 18 h, "Boa noite" after.
String greetingFor(DateTime now) => switch (now.hour) {
  >= 5 && < 12 => 'Bom dia,',
  >= 12 && < 18 => 'Boa tarde,',
  _ => 'Boa noite,',
};
