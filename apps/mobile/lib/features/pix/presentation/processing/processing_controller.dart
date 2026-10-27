import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';

/// The Pix on the processing screen, read until it finishes. Not retried
/// automatically: a failed read offers "Tentar de novo".
final AsyncNotifierProvider<ProcessingController, PixTransfer> Function(String)
processingControllerProvider = AsyncNotifierProvider.autoDispose
    .family<ProcessingController, PixTransfer, String>(
      ProcessingController.new,
      retry: (_, _) => null,
    );

/// Follows one Pix until the money moves or fails (screen 9). In V1 that
/// happens within the authorization (domain-model.md 4), so a Pix still
/// processing after [maxReads] reads is shown as such, not waited forever.
class ProcessingController extends AsyncNotifier<PixTransfer> {
  /// Creates the controller of the Pix [transferId].
  new(this.transferId);

  /// The Pix being followed.
  final String transferId;

  /// Most reads of one Pix, a second apart.
  static const int maxReads = 10;

  @override
  Future<PixTransfer> build() async {
    final repository = ref.read(pixRepositoryProvider);
    var transfer = await repository.fetch(transferId);
    for (
      var reads = 1;
      reads < maxReads && transfer.status == PixStatus.processing;
      reads++
    ) {
      await ref.read(pixPollDelayProvider)();
      if (!ref.mounted) return transfer;
      transfer = await repository.fetch(transferId);
    }
    return transfer;
  }
}

/// Why a processed Pix failed, in the catalog's words (domain-model.md 9).
String failureText(PixFailureReason reason) => switch (reason) {
  PixFailureReason.insufficientFunds => 'Saldo insuficiente.',
  PixFailureReason.limitExceeded => 'Valor acima do seu limite.',
  PixFailureReason.payeeUnavailable =>
    'A conta de destino não pode receber Pix agora.',
  PixFailureReason.accountBlocked =>
    'Sua conta está bloqueada. Fale com o suporte.',
  PixFailureReason.payeeBankRejected =>
    'O banco do recebedor recusou o Pix. O valor voltou para sua conta.',
  // A reason a later API adds (A4): no explanation is better than a wrong one.
  PixFailureReason.unknown => '',
};
