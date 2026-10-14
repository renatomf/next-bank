import 'package:next_bank/core/share/text_sharer.dart';
import 'package:share_plus/share_plus.dart';

/// The system's share sheet, through share_plus.
class SharePlusTextSharer implements TextSharer {
  @override
  Future<void> share(String text) async {
    await SharePlus.instance.share(ShareParams(text: text));
  }
}
