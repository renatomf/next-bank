import 'package:next_bank/core/share/text_sharer.dart';

/// The system's share sheet without the system: keeps what it was given.
class FakeTextSharer implements TextSharer {
  /// Texts shared, in order.
  final List<String> texts = [];

  @override
  Future<void> share(String text) async => texts.add(text);
}
