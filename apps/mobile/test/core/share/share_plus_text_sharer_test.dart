import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/share/share_plus_text_sharer.dart';
import 'package:share_plus/share_plus.dart';
import 'package:share_plus_platform_interface/share_plus_platform_interface.dart';

/// The platform side of share_plus, without Android: records what it got.
class _FakeSharePlatform extends SharePlatform {
  final List<ShareParams> shared = [];

  @override
  Future<ShareResult> share(ShareParams params) async {
    shared.add(params);
    return const ShareResult('done', ShareResultStatus.success);
  }
}

// v1.1.0 plan, task 3: the "Copia e Cola" goes to the share sheet alone.
void main() {
  test('shares only the text, with no file', () async {
    final platform = _FakeSharePlatform();
    final sharer = SharePlusTextSharer(sharePlus: SharePlus.custom(platform));

    await sharer.shareText('000201...6304ABCD');

    final params = platform.shared.single;
    expect(params.text, '000201...6304ABCD');
    expect(params.files, isNull);
  });
}
