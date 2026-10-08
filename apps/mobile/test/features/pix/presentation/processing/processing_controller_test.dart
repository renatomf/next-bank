import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/processing/processing_controller.dart';

import '../../../../support/fake_pix_repository.dart';

const _transferId = 'pix-1';

typedef Setup = ({
  ProviderContainer container,
  FakePixRepository repository,
  List<void> waits,
});

Setup setUpProcessing() {
  final repository = FakePixRepository();
  final waits = <void>[];
  final container = ProviderContainer(
    overrides: [
      pixRepositoryProvider.overrideWithValue(repository),
      pixPollDelayProvider.overrideWithValue(() async => waits.add(null)),
    ],
  );
  addTearDown(container.dispose);
  container.listen(processingControllerProvider(_transferId), (_, _) {});
  return (container: container, repository: repository, waits: waits);
}

/// Answers the reads with [statuses] in order, repeating the last one.
void answerReads(FakePixRepository repository, List<PixStatus> statuses) {
  var read = 0;
  repository.fetchAnswer = () async {
    final status =
        statuses[read < statuses.length ? read : statuses.length - 1];
    read++;
    return pixTransfer(
      status: status,
      failureReason: status == PixStatus.failed
          ? PixFailureReason.insufficientFunds
          : null,
    );
  };
}

Future<PixTransfer> settled(ProviderContainer container) =>
    container.read(processingControllerProvider(_transferId).future);

// Screen 9 (domain-model.md 11): processing · failed (with reason). In V1 the
// money moves within the authorization, so processing is rarely seen
// (domain-model.md 4), but the screen never assumes it.
void main() {
  test('shows a Pix that already finished', () async {
    final (:container, :repository, :waits) = setUpProcessing();
    answerReads(repository, [PixStatus.completed]);

    final transfer = await settled(container);

    expect(transfer.status, PixStatus.completed);
    expect(repository.callsOf('fetch').single.transferId, _transferId);
    expect(waits, isEmpty);
  });

  test('reads again, a second apart, until the Pix finishes', () async {
    final (:container, :repository, :waits) = setUpProcessing();
    answerReads(repository, [
      PixStatus.processing,
      PixStatus.processing,
      PixStatus.failed,
    ]);

    final transfer = await settled(container);

    expect(transfer.status, PixStatus.failed);
    expect(repository.callsOf('fetch'), hasLength(3));
    expect(waits, hasLength(2));
  });

  test('stops after ${ProcessingController.maxReads} reads', () async {
    final (:container, :repository, :waits) = setUpProcessing();
    answerReads(repository, [PixStatus.processing]);

    final transfer = await settled(container);

    expect(transfer.status, PixStatus.processing);
    expect(
      repository.callsOf('fetch'),
      hasLength(ProcessingController.maxReads),
    );
  });

  test('reports a read that failed', () async {
    final (:container, :repository, waits: _) = setUpProcessing();
    repository.fetchAnswer = () async => throw const ApiUnreachable();

    await expectLater(settled(container), throwsA(isA<ApiUnreachable>()));
  });

  // domain-model.md 9: a Pix that failed says why, in the catalog's words.
  group('failureText', () {
    for (final (reason, text) in [
      (PixFailureReason.insufficientFunds, 'Saldo insuficiente.'),
      (PixFailureReason.limitExceeded, 'Valor acima do seu limite.'),
      (
        PixFailureReason.payeeUnavailable,
        'A conta de destino não pode receber Pix agora.',
      ),
      (
        PixFailureReason.accountBlocked,
        'Sua conta está bloqueada. Fale com o suporte.',
      ),
    ]) {
      test(reason.name, () {
        expect(failureText(reason), text);
      });
    }
  });
}
