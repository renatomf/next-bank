import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/unlock/domain/unlock_repository.dart';

/// Where the PIN is checked. Bound to `HttpUnlockRepository` by the
/// composition root (`main.dart`); tests override it with a fake.
final Provider<UnlockRepository> unlockRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
