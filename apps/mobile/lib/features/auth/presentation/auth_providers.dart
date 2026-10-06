import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/auth/domain/auth_repository.dart';

/// Repository behind registration, login, PIN and logout.
/// Bound to its implementation by the composition root (`main.dart`);
/// tests override it with a fake.
final Provider<AuthRepository> authRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
