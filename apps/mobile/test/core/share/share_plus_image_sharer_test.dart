import 'dart:io';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/share/share_plus_image_sharer.dart';
import 'package:share_plus/share_plus.dart';
import 'package:share_plus_platform_interface/share_plus_platform_interface.dart';

/// The platform side of share_plus, without Android: records what it got
/// and whether the file was there when it got it.
class _FakeSharePlatform extends SharePlatform {
  final List<ShareParams> shared = [];
  final List<bool> fileExisted = [];

  @override
  Future<ShareResult> share(ShareParams params) async {
    shared.add(params);
    fileExisted.add(File(params.files!.single.path).existsSync());
    return const ShareResult('done', ShareResultStatus.success);
  }
}

// v1.1.0 plan, task 1: the receipt image goes to the share sheet alone, with
// no text, and the file made for it does not stay behind (MOB-09).
void main() {
  late Directory temp;
  late _FakeSharePlatform platform;
  late SharePlusImageSharer sharer;

  setUp(() {
    temp = Directory.systemTemp.createTempSync('receipts');
    platform = _FakeSharePlatform();
    sharer = SharePlusImageSharer(
      sharePlus: SharePlus.custom(platform),
      temporaryDirectory: () async => temp,
    );
  });

  tearDown(() => temp.deleteSync(recursive: true));

  final png = Uint8List.fromList([137, 80, 78, 71, 13, 10, 26, 10]);

  test('shares only the PNG, by its name, with no text', () async {
    await sharer.shareImage(png: png, fileName: 'comprovante-pix.png');

    final params = platform.shared.single;
    expect(params.text, isNull);
    expect(params.files!.single.mimeType, 'image/png');
    expect(params.fileNameOverrides, ['comprovante-pix.png']);
    expect(platform.fileExisted, [true]);
  });

  test('leaves no file behind once shared', () async {
    await sharer.shareImage(png: png, fileName: 'a.png');

    expect(temp.listSync(recursive: true).whereType<File>(), isEmpty);
  });

  test('leaves no file behind when sharing fails', () async {
    final failing = SharePlusImageSharer(
      sharePlus: SharePlus.custom(_FailingSharePlatform()),
      temporaryDirectory: () async => temp,
    );

    await expectLater(
      failing.shareImage(png: png, fileName: 'a.png'),
      throwsA(isA<StateError>()),
    );
    expect(temp.listSync(recursive: true).whereType<File>(), isEmpty);
  });
}

class _FailingSharePlatform extends SharePlatform {
  @override
  Future<ShareResult> share(ShareParams params) =>
      Future.error(StateError('no share sheet'));
}
