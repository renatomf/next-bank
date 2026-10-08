import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The device's clock, only for what the customer reads, such as the
/// greeting or "Hoje, 09:12": no business rule depends on it (PIX-10).
/// Tests set the time.
final Provider<DateTime Function()> nowProvider = Provider(
  (ref) => DateTime.now,
);
