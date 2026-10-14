final RegExp _uuidV4 = RegExp(
  r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$',
);

/// Whether [key] is a random Pix key: a UUID v4, the only kind a shared QR
/// Code may carry, so the CPF never goes in one (PIX-12).
bool isRandomPixKey(String key) => _uuidV4.hasMatch(key);

/// The customer's random key, to receive by QR Code (v1.1.0 plan, task 3).
class ReceivingKey {
  /// Creates the key as the server sent it.
  const new({required this.key, required this.keyMasked});

  /// The whole key, which only the QR Code and the "Copia e Cola" carry.
  final String key;

  /// The key with only its ends showing, for the screen's text.
  final String keyMasked;
}
