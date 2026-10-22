import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';

final Random _secure = Random.secure();

/// A new `Idempotency-Key`: a UUID version 4 whose 122 random bits come from
/// the platform's cryptographic generator (ADR 0007; week 6 plan, D11), so a
/// key can be neither guessed nor repeated by chance. Tests may pass their
/// own [random].
String newIdempotencyKey([Random? random]) {
  final source = random ?? _secure;
  final bytes = List<int>.generate(16, (_) => source.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  final hex = [for (final byte in bytes) byte.toRadixString(16).padLeft(2, '0')]
      .join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
      '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}

/// Draws the idempotency key of each new attempt (D11), for every command
/// that moves money; tests override it to see when a key is drawn.
final Provider<String Function()> idempotencyKeysProvider = Provider(
  (ref) => newIdempotencyKey,
);
