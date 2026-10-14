import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/session/biometric_pin_store.dart';
import 'package:next_bank/core/session/secure_biometric_pin_store.dart';
import 'package:next_bank/core/session/secure_greeting_name_store.dart';

/// The Keystore without Android: keeps values per key and records the
/// Android options of every call; [readError] makes the next read fail as
/// the platform does.
class _FakeStorage extends FlutterSecureStorage {
  new();

  final Map<String, String> values = {};
  final List<AndroidOptions?> options = [];
  PlatformException? readError;
  final List<String> deleted = [];

  @override
  Future<void> write({
    required String key,
    required String? value,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    options.add(aOptions);
    if (value != null) values[key] = value;
  }

  @override
  Future<String?> read({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    options.add(aOptions);
    final error = readError;
    if (error != null) throw error;
    return values[key];
  }

  @override
  Future<bool> containsKey({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    options.add(aOptions);
    return values.containsKey(key);
  }

  @override
  Future<void> delete({
    required String key,
    AppleOptions? iOptions,
    AndroidOptions? aOptions,
    LinuxOptions? lOptions,
    WebOptions? webOptions,
    AppleOptions? mOptions,
    WindowsOptions? wOptions,
  }) async {
    options.add(aOptions);
    deleted.add(key);
    values.remove(key);
  }
}

PlatformException _promptError(int code) => PlatformException(
  code: 'Exception encountered',
  message: 'Biometric authentication error [$code]: closed',
);

// v1.1.0 plan, task 2: the PIN behind the phone's strong biometrics, in a
// storage space of its own (MOB-11).
void main() {
  late _FakeStorage storage;
  late SecureBiometricPinStore store;

  setUp(() {
    storage = _FakeStorage();
    store = SecureBiometricPinStore(
      storage: storage,
      hasStrongBiometrics: () async => true,
    );
  });

  test('keeps the PIN in a storage space apart from the session', () async {
    await store.save('2580');

    expect(storage.values.values, ['2580']);
    expect(storage.options.single?.storageNamespace, 'biometric_pin');
    expect(storage.options.single?.biometricPromptNegativeButton, 'Usar PIN');
  });

  test('releases the PIN biometrics allow', () async {
    await store.save('2580');

    expect(await store.read(), isA<BiometricPin>());
    expect(((await store.read()) as BiometricPin).pin, '2580');
  });

  test('tells whether a PIN is kept without asking for biometrics', () async {
    expect(await store.hasPin(), isFalse);
    await store.save('2580');
    expect(await store.hasPin(), isTrue);
  });

  test('reports the PIN lost when nothing is kept any more', () async {
    expect(await store.read(), isA<BiometricPinLost>());
  });

  for (final code in [5, 10, 13]) {
    test('reports a cancel for prompt error $code, keeping the PIN', () async {
      await store.save('2580');
      storage.readError = _promptError(code);

      expect(await store.read(), isA<BiometricCancelled>());
      expect(storage.deleted, isEmpty);
    });
  }

  test(
    'reports the PIN lost, and forgets it, when the key was voided',
    () async {
      await store.save('2580');
      storage.readError = PlatformException(
        code: 'Exception encountered',
        message: 'android.security.keystore.KeyPermanentlyInvalidatedException',
      );

      expect(await store.read(), isA<BiometricPinLost>());
      expect(storage.values, isEmpty);
    },
  );

  test('falls back to the typed PIN on any other failure', () async {
    await store.save('2580');
    storage.readError = _promptError(7);

    expect(await store.read(), isA<BiometricCancelled>());
  });

  test('forgets the PIN', () async {
    await store.save('2580');

    await store.clear();

    expect(await store.hasPin(), isFalse);
  });

  test('asks the phone whether strong biometrics are enrolled', () async {
    final without = SecureBiometricPinStore(
      storage: storage,
      hasStrongBiometrics: () async => false,
    );

    expect(await store.isAvailable(), isTrue);
    expect(await without.isAvailable(), isFalse);
  });

  group('SecureGreetingNameStore', () {
    test('keeps, reads and forgets the first name', () async {
      final greeting = SecureGreetingNameStore(storage: storage);

      await greeting.write('Ana');
      expect(await greeting.read(), 'Ana');
      await greeting.clear();

      expect(await greeting.read(), isNull);
    });
  });
}
