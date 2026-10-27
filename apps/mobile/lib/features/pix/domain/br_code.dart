import 'package:next_bank/core/cpf.dart';
import 'package:next_bank/features/pix/domain/pix_key_input.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/domain/receiving_key.dart';

/// Field 26 holds at most 99 characters: the GUI (18) and a 36-character
/// random key (40) leave 37 for the message, after its own id and length.
const int maxBrCodeMessageLength = 37;

const String _pixGui = 'br.gov.bcb.pix';
const int _maxNameLength = 25;
// A fictitious bank has no branch: the city of its demo (v1.1.0 plan, task 3).
const String _city = 'SAO PAULO';
const int _maxAmountCents = 999999999999; // "9999999999.99", 13 characters.

final RegExp _printableAscii = RegExp(r'^[\x20-\x7E]*$');
final RegExp _blanks = RegExp(r'\s+');
final RegExp _notNameCharacter = RegExp('[^A-Z0-9 ]');

const Map<String, String> _accents = {
  'á': 'a', 'à': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', //
  'é': 'e', 'è': 'e', 'ê': 'e', 'ë': 'e', //
  'í': 'i', 'ì': 'i', 'î': 'i', 'ï': 'i', //
  'ó': 'o', 'ò': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', //
  'ú': 'u', 'ù': 'u', 'û': 'u', 'ü': 'u', //
  'ç': 'c', 'ñ': 'n', //
  'Á': 'A', 'À': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', //
  'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E', //
  'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I', //
  'Ó': 'O', 'Ò': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', //
  'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U', //
  'Ç': 'C', 'Ñ': 'N',
};

String _withoutAccents(String text) =>
    text.split('').map((char) => _accents[char] ?? char).join();

/// The message as the code carries it: without accents, which not every
/// reader decodes, and without blanks around it.
String brCodeMessageText(String message) => _withoutAccents(message.trim());

/// The static Pix BR Code (Bacen, Manual de Padrões para Iniciação do Pix;
/// EMV-MPM) for the customer's random key, the text behind the QR Code and
/// the "Copia e Cola". The key must be a random one: a CPF never goes in a
/// code people share (PIX-12).
///
/// Throws [ArgumentError] for a key that is not random, an amount below one
/// cent or above the field, or a message that does not fit.
String staticBrCode({
  required String key,
  required String receiverName,
  int? amountCents,
  String? message,
}) {
  if (!isRandomPixKey(key)) {
    throw ArgumentError.value('(hidden)', 'key', 'must be a random Pix key');
  }
  final text = message == null ? '' : brCodeMessageText(message);
  if (text.length > maxBrCodeMessageLength || !_printableAscii.hasMatch(text)) {
    throw ArgumentError.value(text.length, 'message', 'does not fit the code');
  }
  if (amountCents != null &&
      (amountCents < 1 || amountCents > _maxAmountCents)) {
    throw ArgumentError.value(amountCents, 'amountCents', 'out of range');
  }

  final account = StringBuffer()
    ..write(_field('00', _pixGui))
    ..write(_field('01', key));
  if (text.isNotEmpty) account.write(_field('02', text));

  final payload = StringBuffer()
    ..write(_field('00', '01'))
    ..write(_field('26', account.toString()))
    ..write(_field('52', '0000'))
    ..write(_field('53', '986'));
  if (amountCents != null) payload.write(_field('54', _reais(amountCents)));
  payload
    ..write(_field('58', 'BR'))
    ..write(_field('59', _name(receiverName)))
    ..write(_field('60', _city))
    // A static code has no transaction id: "***" by the manual.
    ..write(_field('62', _field('05', '***')))
    ..write('6304');
  final body = payload.toString();
  return '$body${crc16Ccitt(body)}';
}

String _field(String id, String value) =>
    '$id${value.length.toString().padLeft(2, '0')}$value';

/// Integer cents to "10.50": never through a double (ADR 0006).
String _reais(int cents) =>
    '${cents ~/ 100}.${(cents % 100).toString().padLeft(2, '0')}';

String _name(String name) {
  final plain = _withoutAccents(name)
      .toUpperCase()
      .replaceAll(_notNameCharacter, '')
      .replaceAll(_blanks, ' ')
      .trim();
  return plain.length > _maxNameLength
      ? plain.substring(0, _maxNameLength).trimRight()
      : plain;
}

/// CRC-16/CCITT-FALSE (polynomial 0x1021, start 0xFFFF), the BR Code's
/// field 63, as four uppercase hexadecimal digits.
String crc16Ccitt(String text) {
  var crc = 0xFFFF;
  for (final byte in text.codeUnits) {
    crc ^= byte << 8;
    for (var bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) != 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xFFFF;
    }
  }
  return crc.toRadixString(16).toUpperCase().padLeft(4, '0');
}

/// The code is not a static Pix the app can pay: broken, changed after its
/// CRC, dynamic, or not a Pix at all (PIX-13, MOB-06). Never carries the
/// text read (MOB-02).
final class InvalidQrCode implements Exception {
  /// Creates the error.
  const new();

  @override
  String toString() => 'InvalidQrCode';
}

/// The code is a valid Pix, to a kind of key the next bank does not register
/// (e-mail, phone, CNPJ).
final class UnsupportedPixKey implements Exception {
  /// Creates the error.
  const new();

  @override
  String toString() => 'UnsupportedPixKey';
}

/// What a static code asks to pay. The name it carries is left out on
/// purpose: the screen shows the one the server returns for the key (PIX-11).
final class BrCodePayment {
  /// Creates the payment read from a code.
  const new({
    required this.key,
    required this.keyType,
    this.amountCents,
    this.message,
  });

  /// The key to pay, normalized.
  final String key;

  /// The kind of [key]: CPF or random.
  final PixKeyType keyType;

  /// The fixed amount, in integer cents; null lets the payer type it.
  final int? amountCents;

  /// The message for the payer, if any.
  final String? message;
}

final RegExp _anyUuid = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
);
final RegExp _cpfDigits = RegExp(r'^\d{11}$');
final RegExp _cnpjDigits = RegExp(r'^\d{14}$');
final RegExp _phone = RegExp(r'^\+\d{8,15}$');
final RegExp _twoDigits = RegExp(r'^\d{2}$');
final RegExp _amount = RegExp(r'^(\d{1,10})(?:\.(\d{1,2}))?$');

/// Reads a static Pix code (the QR Code or its "Copia e Cola") to pay it.
/// The whole code is checked, CRC first, before anything of it is used.
///
/// Throws [InvalidQrCode] for anything that is not a valid static Pix and
/// [UnsupportedPixKey] for a key the next bank does not register.
BrCodePayment parseBrCode(String text) {
  final code = text.trim();
  if (code.length < 8) throw const InvalidQrCode();
  final body = code.substring(0, code.length - 4);
  if (!body.endsWith('6304') ||
      crc16Ccitt(body) != code.substring(code.length - 4).toUpperCase()) {
    throw const InvalidQrCode();
  }
  final fields = _fieldsOf(code);
  if (fields['00'] != '01' || fields['53'] != '986' || fields['58'] == null) {
    throw const InvalidQrCode();
  }
  final account = _pixAccountOf(fields);
  // A dynamic code carries a URL (25) instead of the key (01).
  final key = account['01'];
  if (key == null) throw const InvalidQrCode();
  final amount = fields['54'];
  final message = account['02']?.trim() ?? '';
  final (normalized, type) = _keyOf(key);
  return BrCodePayment(
    key: normalized,
    keyType: type,
    amountCents: amount == null ? null : _cents(amount),
    message: message.isEmpty ? null : message,
  );
}

/// The EMV fields of [text], id to value; a broken length is an invalid code.
Map<String, String> _fieldsOf(String text) {
  final fields = <String, String>{};
  var at = 0;
  while (at < text.length) {
    if (at + 4 > text.length) throw const InvalidQrCode();
    final id = text.substring(at, at + 2);
    final size = text.substring(at + 2, at + 4);
    if (!_twoDigits.hasMatch(id) || !_twoDigits.hasMatch(size)) {
      throw const InvalidQrCode();
    }
    final end = at + 4 + int.parse(size);
    if (end > text.length) throw const InvalidQrCode();
    fields[id] = text.substring(at + 4, end);
    at = end;
  }
  return fields;
}

/// The merchant account field of the Pix arrangement, among ids 26 to 51.
Map<String, String> _pixAccountOf(Map<String, String> fields) {
  for (var id = 26; id <= 51; id++) {
    final value = fields['$id'];
    if (value == null) continue;
    final account = _fieldsOf(value);
    if (account['00']?.toLowerCase() == _pixGui) return account;
  }
  throw const InvalidQrCode();
}

(String, PixKeyType) _keyOf(String raw) {
  final key = raw.trim();
  final lower = key.toLowerCase();
  if (_anyUuid.hasMatch(lower)) return (lower, PixKeyType.random);
  if (_cpfDigits.hasMatch(key)) {
    if (!isValidCpf(key)) throw const InvalidQrCode();
    return (key, PixKeyType.cpf);
  }
  // Keys of other banks (v1.2.0 plan, task 5, A2), read as the API looks
  // them up; a phone must be Brazilian, as the DICT keeps it.
  if (key.contains('@') || _phone.hasMatch(key)) {
    final other = pixKeyOf(key);
    if (other == null || other.type == PixKeyType.cpf) {
      throw const InvalidQrCode();
    }
    return (other.value, other.type);
  }
  if (_cnpjDigits.hasMatch(key)) throw const UnsupportedPixKey();
  throw const InvalidQrCode();
}

/// "10.50", "10.5" or "10" to integer cents, by text: never a double
/// (ADR 0006). Zero is no amount to pay.
int _cents(String text) {
  final match = _amount.firstMatch(text);
  if (match == null) throw const InvalidQrCode();
  final cents =
      int.parse(match[1]!) * 100 + int.parse((match[2] ?? '').padRight(2, '0'));
  if (cents < 1) throw const InvalidQrCode();
  return cents;
}
