import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/idempotency_key.dart';
import 'package:next_bank/features/pix/domain/pix_repository.dart';

/// Where Pix are sent. Bound to `HttpPixRepository` by the composition root
/// (`main.dart`); tests override it with a fake.
final Provider<PixRepository> pixRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// The pause between two reads of a Pix still processing; tests skip it.
final Provider<Future<void> Function()> pixPollDelayProvider = Provider(
  (ref) =>
      () => Future<void>.delayed(const Duration(seconds: 1)),
);

/// Draws the idempotency key of each new attempt (D11); tests override it to
/// see when a key is drawn.
final Provider<String Function()> idempotencyKeysProvider = Provider(
  (ref) => newIdempotencyKey,
);
