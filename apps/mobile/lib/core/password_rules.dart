/// A password of 10 to 128 characters (AUTH-07, AUTH-08), counted as the
/// API counts them: Unicode code points, not UTF-16 units. A local check, so
/// the customer learns at once; the API stays the authority.
bool hasAcceptablePasswordLength(String password) {
  final length = password.runes.length;
  return length >= 10 && length <= 128;
}
