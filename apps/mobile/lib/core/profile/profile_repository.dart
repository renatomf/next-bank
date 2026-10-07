import 'package:next_bank/core/profile/profile.dart';

/// Reads the signed-in customer's profile from the API.
/// Failures are reported as `ApiFailure` with the catalog code.
abstract interface class ProfileRepository {
  /// The profile of the session's account.
  Future<Profile> fetch();
}
