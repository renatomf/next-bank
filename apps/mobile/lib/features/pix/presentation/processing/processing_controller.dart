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

/// Follows one Pix until the money moves or fails (screen 9). A Pix between
/// next bank customers ends within the authorization; one to another bank
/// waits for the SPI, seconds by webhook or minutes by the status check
/// (v1.2.0 plan, task 5, A3). So the Pix is read again, waiting 1, 2, 4 and
/// then [longestWait], for up to [patience]; still processing then, it is
/// shown as such and the statement tells the rest. It only reads: a Pix is
/// never sent again from here (MOB-07).
class ProcessingController extends AsyncNotifier<PixTransfer> {
  /// Creates the controller of the Pix [transferId].
  new(this.transferId);

  /// The Pix being followed.
  final String transferId;

  /// How long the Pix is followed before it is shown still processing.
  static const Duration patience = Duration(minutes: 1);

  /// The longest wait between two reads.
  static const Duration longestWait = Duration(seconds: 8);

  @override
  Future<PixTransfer> build() async {
    final repository = ref.read(pixRepositoryProvider);
    var transfer = await repository.fetch(transferId);
    var waited = Duration.zero;
    var next = const Duration(seconds: 1);
    while (transfer.status == PixStatus.processing && waited < patience) {
      final left = patience - waited;
      final wait = next < left ? next : left;
      await ref.read(pixPollDelayProvider)(wait);
      if (!ref.mounted) return transfer;
      waited += wait;
      next = next * 2 < longestWait ? next * 2 : longestWait;
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
