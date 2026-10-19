import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile.dart';
import 'package:next_bank/core/session/session_controller.dart';

/// The app's screens.
abstract final class AppRoutes {
  /// Shown while the session is restored from the device.
  static const String splash = '/splash';

  /// Entry point without a session.
  static const String login = '/login';

  /// Registration with a fictitious CPF.
  static const String register = '/register';

  /// Transaction PIN creation, whenever the account has no PIN yet.
  static const String createPin = '/create-pin';

  /// The PIN before anything of the account (F-16).
  static const String unlock = '/unlock';

  /// Home of a signed-in user.
  static const String home = '/home';

  /// Sending a Pix (screen 7).
  static const String pix = '/pix';

  /// Paying a Pix by QR Code, with the camera or pasted (v1.1.0 plan,
  /// task 4).
  static const String pixScan = '$pix/scan';

  /// Transferring a Pix (v1.1.0 plan, task 4.2): blank for now.
  static const String pixTransfer = '$pix/transfer';

  /// Pix Automático (v1.1.0 plan, task 4.2): blank for now.
  static const String pixAutomatic = '$pix/automatic';

  /// The customer's Pix keys (v1.1.0 plan, task 4.2): blank for now.
  static const String pixKeys = '$pix/keys';

  /// Receiving a Pix by QR Code (v1.1.0 plan, task 3).
  static const String pixReceive = '$pix/receive';

  /// The review of the Pix [transferId], with the PIN (screen 8).
  static String pixReview(String transferId) => '$pix/review/$transferId';

  /// The Pix [transferId] being processed (screen 9).
  static String pixProcessing(String transferId) =>
      '$pix/processing/$transferId';

  /// The receipt of the Pix [transferId] (screen 10).
  static String pixReceipt(String transferId) => '$pix/receipt/$transferId';

  /// The statement (screen 11).
  static const String statement = '/statement';

  /// The detail of the movement [itemId] (screen 12).
  static String statementItem(String itemId) => '$statement/$itemId';

  /// Help, over the Home (v1.1.0 plan, task 4.5).
  static const String help = '/help';

  /// Notifications, over the Home (v1.1.0 plan, task 4.6).
  static const String notifications = '/notifications';

  /// The notification settings, over the notifications.
  static const String notificationSettings = '$notifications/settings';

  /// The customer and the way out (screen 13).
  static const String profile = '/profile';

  /// The theme picker, over the profile (v1.1.0 plan, task 4.4).
  static const String profileTheme = '$profile/theme';

  /// Security opened from the profile, over it, with the way back.
  static const String profileSecurity = '$profile/security';

  /// Blank for now: the customer's registration data.
  static const String personalData = '$profile/personal-data';

  /// Blank for now: an account shared with someone else.
  static const String sharedAccount = '$profile/shared-account';

  /// Blank for now: inviting friends.
  static const String inviteFriends = '$profile/invite-friends';

  /// Blank for now: the customer's accounts.
  static const String manageAccounts = '$profile/manage-accounts';

  /// Sessions and credentials (screen 14).
  static const String security = '/security';

  /// A new PIN with the password, also how a locked PIN works again.
  static const String changePin = '$security/change-pin';

  /// A new password, ending the other sessions.
  static const String changePassword = '$security/change-password';
}

/// Where the app must be for the current [session] and its [profile], or
/// null to stay at [location] (domain-model.md, section 10). An ended
/// session goes back to login from any screen; an account without its PIN
/// always resumes at the PIN creation; a [locked] app asks for the PIN first.
String? redirectFor(
  AsyncValue<Session> session,
  AsyncValue<Profile?> profile,
  String location, {
  required bool locked,
}) {
  final target = switch (session) {
    AsyncData(value: SignedIn()) => _signedInTarget(profile, location, locked),
    AsyncData(value: SignedOut()) =>
      location == AppRoutes.register ? location : AppRoutes.login,
    // Still restoring, or the device storage failed: splash shows which.
    _ => AppRoutes.splash,
  };
  return target == location ? null : target;
}

String _signedInTarget(
  AsyncValue<Profile?> profile,
  String location,
  bool locked,
) => switch (profile) {
  AsyncData(value: Profile(hasPin: false)) => AppRoutes.createPin,
  AsyncData(value: Profile(hasPin: true)) when locked => AppRoutes.unlock,
  AsyncData(value: Profile(hasPin: true)) => switch (location) {
    AppRoutes.splash ||
    AppRoutes.login ||
    AppRoutes.register ||
    AppRoutes.createPin ||
    AppRoutes.unlock => AppRoutes.home,
    _ => location,
  },
  // Not known yet, or it could not be loaded: splash shows which.
  _ => AppRoutes.splash,
};
