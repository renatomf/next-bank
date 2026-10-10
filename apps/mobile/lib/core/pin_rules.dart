/// Whether [pin] can be the transaction PIN, with the same rule as the API
/// (domain-model.md 3.1): 4 ASCII digits, not repeated and not in sequence,
/// the first guesses of anyone trying PINs.
bool isAcceptablePin(String pin) =>
    _fourDigits.hasMatch(pin) &&
    !_repeatedDigits.hasMatch(pin) &&
    !_ascending.contains(pin) &&
    !_descending.contains(pin);

// ASCII digits only, as the API: other scripts' digits are refused.
final RegExp _fourDigits = RegExp(r'^[0-9]{4}$');
final RegExp _repeatedDigits = RegExp(r'^(\d)\1{3}$');
const String _ascending = '0123456789';
const String _descending = '9876543210';
