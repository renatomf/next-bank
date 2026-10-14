/// Field 26 holds at most 99 characters: the GUI (18) and a 36-character
/// random key (40) leave 37 for the message, after its own id and length.
const int maxBrCodeMessageLength = 37;

const String _pixGui = 'br.gov.bcb.pix';
const int _maxNameLength = 25;
// A fictitious bank has no branch: the city of its demo (v1.1.0 plan, task 3).
const String _city = 'SAO PAULO';
const int _maxAmountCents = 999999999999; // "9999999999.99", 13 characters.

final RegExp _randomKey = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);
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
  if (!_randomKey.hasMatch(key)) {
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
