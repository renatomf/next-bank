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
  List<Duration> waits,
});

Setup setUpProcessing() {
  final repository = FakePixRepository();
  final waits = <Duration>[];
  final container = ProviderContainer(
    overrides: [
      pixRepositoryProvider.overrideWithValue(repository),
      pixPollDelayProvider.overrideWithValue((wait) async => waits.add(wait)),
    ],
  );
  addTearDown(container.dispose);
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

/// Opens the screen, after the test set the answers, and waits for the end.
Future<PixTransfer> settled(ProviderContainer container) {
  final provider = processingControllerProvider(_transferId);
  container.listen(provider, (_, _) {});
  return container.read(provider.future);
}

// Screen 9 (domain-model.md 11): processing · failed (with reason). A Pix
// between next bank customers ends within the authorization; one to another
// bank waits for the SPI, seconds by webhook or minutes by the status check
// (v1.2.0 plan, task 5, A3), so the screen reads it again, waiting longer
// each time, for up to a minute. It only reads: it never sends again (MOB-07).
void main() {
  test('shows a Pix that already finished', () async {
    final (:container, :repository, :waits) = setUpProcessing();
    answerReads(repository, [PixStatus.completed]);

    final transfer = await settled(container);

    expect(transfer.status, PixStatus.completed);
    expect(repository.callsOf('fetch').single.transferId, _transferId);
    expect(waits, isEmpty);
  });

  test(
    'reads again, waiting longer each time, until the Pix finishes',
    () async {
      final (:container, :repository, :waits) = setUpProcessing();
      answerReads(repository, [
        PixStatus.processing,
        PixStatus.processing,
        PixStatus.failed,
      ]);

      final transfer = await settled(container);

      expect(transfer.status, PixStatus.failed);
      expect(repository.callsOf('fetch'), hasLength(3));
      expect(waits, [const Duration(seconds: 1), const Duration(seconds: 2)]);
    },
  );

  test(
    'waits up to a minute for a Pix still processing, then shows it',
    () async {
      final (:container, :repository, :waits) = setUpProcessing();
      answerReads(repository, [PixStatus.processing]);

      final transfer = await settled(container);

      expect(transfer.status, PixStatus.processing);
      expect(waits, [
        for (final seconds in [1, 2, 4, 8, 8, 8, 8, 8, 8, 5])
          Duration(seconds: seconds),
      ]);
      expect(
        waits.fold(Duration.zero, (total, wait) => total + wait),
        const Duration(minutes: 1),
      );
      // Only reads: the Pix is never sent again (MOB-07).
      expect(repository.callsOf('fetch'), hasLength(11));
      expect(repository.callsOf('authorize'), isEmpty);
    },
  );

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
      (
        PixFailureReason.payeeBankRejected,
        'O banco do recebedor recusou o Pix. O valor voltou para sua conta.',
      ),
      // A4: a reason a later API adds has no explanation, never a wrong one.
      (PixFailureReason.unknown, ''),
    ]) {
      test(reason.name, () {
        expect(failureText(reason), text);
      });
    }
  });
}
