// Local checks that mirror the API's register schema and password policy,
// so the visitor learns at once; the API stays the authority.

/// A name of 2 to 120 characters after trimming, without control
/// characters.
bool isValidName(String name) {
  final trimmed = name.trim();
  return trimmed.length >= 2 &&
      trimmed.length <= 120 &&
      !_controlCharacter.hasMatch(trimmed);
}

/// A password of 10 to 128 characters (AUTH-07, AUTH-08), counted as the
/// API counts them: Unicode code points, not UTF-16 units.
bool hasAcceptablePasswordLength(String password) {
  final length = password.runes.length;
  return length >= 10 && length <= 128;
}

final RegExp _controlCharacter = RegExp(r'\p{Cc}', unicode: true);
