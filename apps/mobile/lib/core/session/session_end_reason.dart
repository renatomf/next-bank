/// Why the server ended the session, so the login screen can say it
/// (catalog, section 9).
enum SessionEndReason {
  /// The session timed out: "Sua sessão expirou."
  expired,

  /// A replaced refresh token came back and the server revoked the session
  /// (AUTH-03): "Por segurança, entre novamente."
  revoked,
}
