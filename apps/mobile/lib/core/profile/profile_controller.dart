import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/profile/profile_repository.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// Where the profile comes from. Bound to `HttpProfileRepository` by the
/// composition root (`main.dart`); tests override it with a fake.
final Provider<ProfileRepository> profileRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// The signed-in customer's profile; null without a session. Kept only in
/// memory: nothing about the customer is written to the device (MOB-01).
/// Not retried automatically: offline, the splash says so and offers
/// "Tentar de novo" (domain-model.md, section 11) instead of loading on.
final AsyncNotifierProvider<ProfileController, Profile?> profileProvider =
    AsyncNotifierProvider(ProfileController.new, retry: (_, _) => null);

/// Loads the profile once per sign-in and keeps the PIN status current.
class ProfileController extends AsyncNotifier<Profile?> {
  @override
  Future<Profile?> build() async {
    // Only signing in or out reloads it: a renewed token is the same account.
    final signedIn = ref.watch(
      sessionProvider.select((session) => session.value is SignedIn),
    );
    if (!signedIn) return null;
    return await ref.read(profileRepositoryProvider).fetch();
  }

  /// The PIN now exists: recorded here, so the navigation moves on without
  /// asking the API again.
  void pinCreated() {
    final profile = state.value;
    if (profile != null) state = AsyncData(profile.withPin());
  }
}
