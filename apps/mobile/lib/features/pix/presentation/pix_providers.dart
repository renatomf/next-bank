import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/profile/profile_controller.dart';
import 'package:next_bank/features/pix/domain/pix_repository.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';

/// Where Pix are sent. Bound to `HttpPixRepository` by the composition root
/// (`main.dart`); tests override it with a fake.
final Provider<PixRepository> pixRepositoryProvider = Provider(
  (ref) => throw UnimplementedError('Bound in main.dart'),
);

/// One Pix as the server has it, read while a screen shows it: the review
/// confirms what the server recorded, not what the app remembers. Not
/// retried automatically: offline, the screen offers "Tentar de novo".
final FutureProvider<PixTransfer> Function(String) pixTransferProvider =
    FutureProvider.autoDispose.family<PixTransfer, String>(
      (ref, transferId) => ref.watch(pixRepositoryProvider).fetch(transferId),
      retry: (_, _) => null,
    );

/// Waits as long as given between two reads of a Pix still processing;
/// tests skip the wait and record it.
final Provider<Future<void> Function(Duration)> pixPollDelayProvider = Provider(
  (ref) => Future<void>.delayed,
);

/// The name a QR Code to receive carries: the signed-in customer's, from the
/// profile the app already holds; null without one.
final Provider<String?> receiverNameProvider = Provider(
  (ref) => ref.watch(profileProvider).value?.name,
);
