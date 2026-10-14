import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/features/pix/domain/br_code.dart';
import 'package:next_bank/features/pix/presentation/pix_providers.dart';
import 'package:next_bank/features/pix/presentation/receive/receive_pix_controller.dart';

import '../../../../support/fake_pix_repository.dart';

(ProviderContainer, FakePixRepository) setUpReceive({
  String? receiverName = 'Bruno Lima',
}) {
  final repository = FakePixRepository();
  final container = ProviderContainer(
    overrides: [
      pixRepositoryProvider.overrideWithValue(repository),
      receiverNameProvider.overrideWithValue(receiverName),
    ],
  );
  addTearDown(container.dispose);
  container.listen(receivePixControllerProvider, (_, _) {});
  return (container, repository);
}

ReceivePixController controllerOf(ProviderContainer container) =>
    container.read(receivePixControllerProvider.notifier);

ReceivePixState stateOf(ProviderContainer container) =>
    container.read(receivePixControllerProvider);

/// The QR Code's text the screen should show for these inputs.
String expectedCode({int? amountCents, String? message}) => staticBrCode(
  key: brunoReceivingKey,
  receiverName: 'Bruno Lima',
  amountCents: amountCents,
  message: message,
);

// The "Receber" screen (v1.1.0 plan, task 3): the customer's random key in a
// static BR Code, with an optional amount and message; never the CPF (PIX-12).
void main() {
  group('loading the key', () {
    test('starts loading, before any code', () {
      final (container, _) = setUpReceive();

      expect(stateOf(container).loading, isTrue);
      expect(stateOf(container).code, isNull);
    });

    test("shows the customer's key and its code once loaded", () async {
      final (container, repository) = setUpReceive();

      await controllerOf(container).load();

      final state = stateOf(container);
      expect(repository.callsOf('receivingKey'), hasLength(1));
      expect(state.loading, isFalse);
      expect(state.keyMasked, '1111****-****-****-****-********5555');
      expect(state.code, expectedCode());
    });

    test('asks once when loaded twice at the same time', () async {
      final (container, repository) = setUpReceive();

      await Future.wait<void>([
        controllerOf(container).load(),
        controllerOf(container).load(),
      ]);

      expect(repository.callsOf('receivingKey'), hasLength(1));
    });

    test('says why when the key does not come, and tries again', () async {
      final (container, repository) = setUpReceive();
      repository.receivingKeyAnswer = () async => throw const ApiUnreachable();

      await controllerOf(container).load();

      expect(stateOf(container).error, isNotNull);
      expect(stateOf(container).code, isNull);

      repository.receivingKeyAnswer = FakePixRepository().receivingKeyAnswer;
      await controllerOf(container).load();

      expect(stateOf(container).error, isNull);
      expect(stateOf(container).code, expectedCode());
    });

    test('shows no code without the name the code carries', () async {
      final (container, _) = setUpReceive(receiverName: null);

      await controllerOf(container).load();

      expect(stateOf(container).code, isNull);
      expect(stateOf(container).error, isNotNull);
    });
  });

  group('the amount', () {
    test('is left to the payer until one is typed', () async {
      final (container, _) = setUpReceive();
      await controllerOf(container).load();

      expect(stateOf(container).amountCents, 0);
      expect(stateOf(container).code, expectedCode());
    });

    test('goes in the code in integer cents (ADR 0006)', () async {
      final (container, _) = setUpReceive();
      await controllerOf(container).load();

      controllerOf(container).typeAmount('2500');

      expect(stateOf(container).amountCents, 2500);
      expect(stateOf(container).code, expectedCode(amountCents: 2500));
    });

    test('leaves the code when cleared back to zero', () async {
      final (container, _) = setUpReceive();
      await controllerOf(container).load();

      controllerOf(container)
        ..typeAmount('2500')
        ..typeAmount('');

      expect(stateOf(container).code, expectedCode());
    });

    test('ignores anything but up to nine digits', () async {
      final (container, _) = setUpReceive();
      await controllerOf(container).load();

      controllerOf(container)
        ..typeAmount('2500')
        ..typeAmount('1234567890')
        ..typeAmount('25,00');

      expect(stateOf(container).amountCents, 2500);
    });
  });

  group('the message', () {
    test('goes in the code without accents', () async {
      final (container, _) = setUpReceive();
      await controllerOf(container).load();

      controllerOf(container).typeMessage('Pão de queijo');

      expect(stateOf(container).message, 'Pão de queijo');
      expect(stateOf(container).code, expectedCode(message: 'Pao de queijo'));
    });

    test('stops at $maxBrCodeMessageLength characters (DEMO-04)', () async {
      final (container, _) = setUpReceive();
      await controllerOf(container).load();
      final longest = 'a' * maxBrCodeMessageLength;

      controllerOf(container)
        ..typeMessage(longest)
        ..typeMessage('${longest}a');

      expect(stateOf(container).message, longest);
    });

    test('ignores characters the code cannot carry', () async {
      final (container, _) = setUpReceive();
      await controllerOf(container).load();

      controllerOf(container)
        ..typeMessage('Pizza')
        ..typeMessage('Pizza 🍕');

      expect(stateOf(container).message, 'Pizza');
    });
  });
}
