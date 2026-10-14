import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:next_bank/core/share/image_sharer.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// The system's share sheet, through share_plus.
class SharePlusImageSharer implements ImageSharer {
  /// Shares through [sharePlus] (share_plus's own by default), writing the
  /// image under [temporaryDirectory] (the app's private cache by default).
  new({SharePlus? sharePlus, Future<Directory> Function()? temporaryDirectory})
    : _sharePlus = sharePlus ?? SharePlus.instance,
      _temporaryDirectory = temporaryDirectory ?? getTemporaryDirectory;

  final SharePlus _sharePlus;
  final Future<Directory> Function() _temporaryDirectory;

  @override
  Future<void> shareImage({
    required Uint8List png,
    required String fileName,
  }) async {
    // Android shares files, not bytes. share_plus copies the file to its own
    // private folder before opening the sheet and clears that folder on the
    // next share, so ours can go at once (MOB-09).
    final folder = await (await _temporaryDirectory()).createTemp('receipt');
    final file = File('${folder.path}/$fileName');
    try {
      await file.writeAsBytes(png, flush: true);
      await _sharePlus.share(
        ShareParams(
          files: [XFile(file.path, mimeType: 'image/png')],
          fileNameOverrides: [fileName],
        ),
      );
    } finally {
      await folder.delete(recursive: true);
    }
  }
}
