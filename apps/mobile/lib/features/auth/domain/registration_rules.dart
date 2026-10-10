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

final RegExp _controlCharacter = RegExp(r'\p{Cc}', unicode: true);
