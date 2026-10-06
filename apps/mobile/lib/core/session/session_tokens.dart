import 'dart:convert';

/// Tokens of the signed-in session (ADR 0004). Kept and stored together, so a
/// refresh token is never paired with an access token from another session.
final class SessionTokens {
  /// Creates the tokens received from the API.
  const new({
    required this.accessToken,
    required this.accessTokenExpiresAt,
    required this.refreshToken,
  });

  /// Short-lived token sent as `Authorization: Bearer` (15 minutes).
  final String accessToken;

  /// When [accessToken] stops being accepted.
  final DateTime accessTokenExpiresAt;

  /// Opaque token exchanged for a new pair; rotated on every use.
  final String refreshToken;

  /// Parses the stored record; returns null when it is not a valid session,
  /// so a corrupted record never becomes a half-valid one.
  static SessionTokens? tryParse(String stored) {
    try {
      final json = jsonDecode(stored);
      if (json is! Map<String, dynamic>) return null;
      final access = json['accessToken'];
      final expiresAt = json['accessTokenExpiresAt'];
      final refresh = json['refreshToken'];
      if (access is! String || refresh is! String || expiresAt is! String) {
        return null;
      }
      final expiry = DateTime.tryParse(expiresAt);
      if (expiry == null) return null;
      return SessionTokens(
        accessToken: access,
        accessTokenExpiresAt: expiry,
        refreshToken: refresh,
      );
    } on FormatException {
      return null;
    }
  }

  /// One record with the three values (written in a single operation).
  String toStorage() => jsonEncode({
    'accessToken': accessToken,
    'accessTokenExpiresAt': accessTokenExpiresAt.toUtc().toIso8601String(),
    'refreshToken': refreshToken,
  });

  /// Never prints the tokens (MOB-02).
  @override
  String toString() => 'SessionTokens(redacted)';
}
