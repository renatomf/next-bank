import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/security/domain/security_repository.dart';

/// Where the sessions and credentials are managed. Bound to
/// `HttpSecurityRepository` by the composition root (`main.dart`); tests
/// override it with a fake.
final Provider<SecurityRepository> securityRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);
