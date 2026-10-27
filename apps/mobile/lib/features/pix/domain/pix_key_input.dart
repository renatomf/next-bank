import 'package:next_bank/core/cpf.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

// The DICT's limits, as the API checks them: an e-mail of at most 77
// characters; a random key that is a UUID v4; a Brazilian phone with its area
// code (DDD 11 to 99), in E.164.
final RegExp _email = RegExp(r'^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$');
const int _maxEmailLength = 77;
final RegExp _randomKey = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);
// Dots are a CPF's punctuation, never a phone's: 123.456.789-0 is a CPF typed
// wrong, not a phone.
final RegExp _phonePunctuation = RegExp(r'[\s()-]');
// A mobile number has a 9 after the area code; a landline starts with 2 to 5.
final RegExp _nationalPhone = RegExp(r'^[1-9][0-9](9[0-9]{8}|[2-5][0-9]{7})$');

/// The key a customer typed, told by its shape (v1.2.0 plan, task 5, A1),
/// normalized as the API looks it up; null when no key can have this value,
/// so it never reaches the API (PIX-07). An "@" is an e-mail; a UUID v4 is a
/// random key; a valid CPF is a CPF; a mobile or landline number with its
/// area code, with or without +55, is a phone.
PixKeyRef? pixKeyOf(String typed) {
  final key = typed.trim();
  final lower = key.toLowerCase();
  if (key.contains('@')) {
    return lower.length <= _maxEmailLength && _email.hasMatch(lower)
        ? (type: PixKeyType.email, value: lower)
        : null;
  }
  if (_randomKey.hasMatch(lower)) {
    return (type: PixKeyType.random, value: lower);
  }
  if (isValidCpf(key)) {
    return (type: PixKeyType.cpf, value: key.replaceAll(RegExp(r'\D'), ''));
  }
  final compact = key.replaceAll(_phonePunctuation, '');
  final national = compact.startsWith('+55') ? compact.substring(3) : compact;
  return _nationalPhone.hasMatch(national)
      ? (type: PixKeyType.phone, value: '+55$national')
      : null;
}
