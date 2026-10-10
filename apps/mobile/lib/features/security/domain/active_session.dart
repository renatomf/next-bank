/// A session of the customer still able to renew, as the Security screen
/// lists it (week 7 plan): no IP and no token, only what tells it apart.
final class ActiveSession {
  /// Creates the session.
  const new({
    required this.id,
    required this.deviceLabel,
    required this.createdAt,
    required this.lastUsedAt,
    required this.current,
  });

  /// The session's id.
  final String id;

  /// "Android" or "iOS", as the app said at sign-in; null when unknown.
  final String? deviceLabel;

  /// When it started.
  final DateTime createdAt;

  /// When it was last used.
  final DateTime lastUsedAt;

  /// Whether it is this device's: ended by signing out, not from the list.
  final bool current;
}
