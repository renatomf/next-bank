import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_failure.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/features/security/presentation/biometrics/biometrics_controller.dart';
import 'package:next_bank/features/security/presentation/security_providers.dart';

import '../../../../support/fake_biometric_pin_store.dart';
import '../../../../support/fake_security_repository.dart';

(ProviderContainer, FakeSecurityRepository) setUpBiometrics(
  FakeBiometricPinStore store,
) {
  final repository = FakeSecurityRepository();
  final container = ProviderContainer(
    overrides: [
      securityRepositoryProvider.overrideWithValue(repository),
      biometricPinStoreProvider.overrideWithValue(store),
    ],
  );
  addTearDown(container.dispose);
  container.listen(biometricsControllerProvider, (_, _) {});
  return (container, repository);
}

Future<BiometricsState> settled(ProviderContainer container) =>
    container.read(biometricsControllerProvider.future);

BiometricsController controllerOf(ProviderContainer container) =>
    container.read(biometricsControllerProvider.notifier);

// v1.1.0 plan, task 2: "Usar biometria" in Security. Enabling keeps the PIN
// only after the server accepts it (MOB-11); the PIN never stays in the
// state (MOB-02).
void main() {
  test('is not offered without strong biometrics on the phone', () async {
    final (container, _) = setUpBiometrics(
      FakeBiometricPinStore(available: false),
    );

    expect((await settled(container)).available, isFalse);
  });

  test('is off with no PIN kept, and on with one', () async {
    final (off, _) = setUpBiometrics(FakeBiometricPinStore());
    final (on, _) = setUpBiometrics(FakeBiometricPinStore(pin: '2580'));

    expect((await settled(off)).enabled, isFalse);
    expect((await settled(on)).enabled, isTrue);
  });

  test('keeps the PIN only after the server accepts it', () async {
    final store = FakeBiometricPinStore();
    final (container, repository) = setUpBiometrics(store);
    await settled(container);

    final enabled = await controllerOf(container).enable('2580');

    expect(enabled, isTrue);
    expect(repository.verifiedPins, ['2580']);
    expect(store.pin, '2580');
    expect((await settled(container)).enabled, isTrue);
  });

  test('keeps nothing when the server refuses the PIN', () async {
    final store = FakeBiometricPinStore();
    final (container, repository) = setUpBiometrics(store);
    repository.answer = () async => throw const ApiRejected(
      ApiErrorCode.pinIncorrect,
      remainingAttempts: 4,
    );
    await settled(container);

    final enabled = await controllerOf(container).enable('7413');

    expect(enabled, isFalse);
    expect(store.pin, isNull);
    final state = await settled(container);
    expect(state.enabled, isFalse);
    expect(state.error, 'PIN incorreto. Restam 4 tentativas.');
  });

  test('forgets the kept PIN when turned off', () async {
    final store = FakeBiometricPinStore(pin: '2580');
    final (container, _) = setUpBiometrics(store);
    await settled(container);

    await controllerOf(container).disable();

    expect(store.pin, isNull);
    expect((await settled(container)).enabled, isFalse);
  });
}
