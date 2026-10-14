import 'package:next_bank/features/pix/domain/pix_repository.dart';
import 'package:next_bank/features/pix/domain/pix_transfer.dart';
import 'package:next_bank/features/pix/domain/receiving_key.dart';

/// Mariana, the payee of the mockups, as the server shows her.
const PixPayee mariana = PixPayee(
  name: 'Mariana Costa',
  documentMasked: '***.456.789-**',
  keyType: PixKeyType.cpf,
  keyMasked: '***.456.789-**',
);

/// Bruno's random key: a UUID v4 plain enough not to look like a secret.
const String brunoReceivingKey = '11111111-2222-4333-8444-555555555555';

/// A Pix of R$ 350,00 to [mariana]; the arguments change what matters.
PixTransfer pixTransfer({
  String id = 'pix-1',
  PixStatus status = PixStatus.awaitingAuth,
  PixFailureReason? failureReason,
  String? endToEndId,
}) => PixTransfer(
  id: id,
  status: status,
  amountCents: 35000,
  description: 'Aluguel de outubro',
  payee: mariana,
  endToEndId: endToEndId,
  failureReason: failureReason,
  createdAt: DateTime.utc(2026, 10, 8, 17, 32),
  completedAt: status == PixStatus.completed
      ? DateTime.utc(2026, 10, 8, 17, 33)
      : null,
);

/// A call the fake received.
typedef PixCall = ({
  String command,
  String? cpf,
  int? amountCents,
  String? description,
  String? transferId,
  String? pin,
  String? idempotencyKey,
});

/// Pix without the API: records every call and answers with what the test
/// set, by default a found key and a Pix waiting for the PIN.
class FakePixRepository implements PixRepository {
  /// What the next lookups do.
  Future<PixPayee> Function() lookupAnswer = () async => mariana;

  /// What the next creations do.
  Future<PixTransfer> Function() createAnswer = () async => pixTransfer();

  /// What the next reads do.
  Future<PixTransfer> Function() fetchAnswer = () async => pixTransfer();

  /// What the next authorizations do.
  Future<PixTransfer> Function() authorizeAnswer = () async =>
      pixTransfer(status: PixStatus.completed);

  /// What the next reads of the receiving key do.
  Future<ReceivingKey> Function() receivingKeyAnswer = () async =>
      const ReceivingKey(
        key: brunoReceivingKey,
        keyMasked: '1111****-****-****-****-********5555',
      );

  /// Calls received, in order.
  final List<PixCall> calls = [];

  /// The calls of one [command]: lookup, create, fetch, authorize or
  /// receivingKey.
  List<PixCall> callsOf(String command) =>
      calls.where((call) => call.command == command).toList();

  @override
  Future<PixPayee> lookup(String cpf) {
    _record('lookup', cpf: cpf);
    return lookupAnswer();
  }

  @override
  Future<PixTransfer> create({
    required String cpf,
    required int amountCents,
    required String? description,
    required String idempotencyKey,
  }) {
    _record(
      'create',
      cpf: cpf,
      amountCents: amountCents,
      description: description,
      idempotencyKey: idempotencyKey,
    );
    return createAnswer();
  }

  @override
  Future<PixTransfer> fetch(String transferId) {
    _record('fetch', transferId: transferId);
    return fetchAnswer();
  }

  @override
  Future<ReceivingKey> receivingKey() {
    _record('receivingKey');
    return receivingKeyAnswer();
  }

  @override
  Future<PixTransfer> authorize({
    required String transferId,
    required String pin,
    required String idempotencyKey,
  }) {
    _record(
      'authorize',
      transferId: transferId,
      pin: pin,
      idempotencyKey: idempotencyKey,
    );
    return authorizeAnswer();
  }

  void _record(
    String command, {
    String? cpf,
    int? amountCents,
    String? description,
    String? transferId,
    String? pin,
    String? idempotencyKey,
  }) => calls.add((
    command: command,
    cpf: cpf,
    amountCents: amountCents,
    description: description,
    transferId: transferId,
    pin: pin,
    idempotencyKey: idempotencyKey,
  ));
}

/// Keys "key-1", "key-2"… in order, so a test sees when a new one is drawn.
String Function() sequentialKeys() {
  var next = 0;
  return () => 'key-${++next}';
}
