import 'package:next_bank/core/share/text_sharer.dart';
import 'package:share_plus/share_plus.dart';

/// The system's share sheet for texts, through share_plus.
class SharePlusTextSharer implements TextSharer {
  /// Shares through [sharePlus], share_plus's own by default.
  new({SharePlus? sharePlus}) : _sharePlus = sharePlus ?? SharePlus.instance;

  final SharePlus _sharePlus;

  @override
  Future<void> shareText(String text) async {
    await _sharePlus.share(ShareParams(text: text));
  }
}
