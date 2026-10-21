import 'package:next_bank/features/top_up/domain/top_up.dart';
import 'package:next_bank/features/top_up/domain/top_up_repository.dart';

/// The three made-up operators of the API (D6), all with the same amounts.
const List<TopUpOperator> topUpOperators = [
  TopUpOperator(
    id: 'onda-movel',
    name: 'Onda Móvel',
    initials: 'OM',
    amountsCents: [1500, 2000, 3000, 5000],
  ),
  TopUpOperator(
    id: 'pulso-celular',
    name: 'Pulso Celular',
    initials: 'PC',
    amountsCents: [1500, 2000, 3000, 5000],
  ),
  TopUpOperator(
    id: 'rede-nova',
    name: 'Rede Nova',
    initials: 'RN',
    amountsCents: [1500, 2000, 3000, 5000],
  ),
];

/// A top-up of R$ 30,00 to a made-up number through Pulso Celular.
TopUp topUpDone({String id = 'top-up-1'}) => TopUp(
  id: id,
  operatorName: 'Pulso Celular',
  operatorInitials: 'PC',
  phoneMasked: '(11) *****-0001',
  amountCents: 3000,
  createdAt: DateTime.utc(2026, 10, 21, 15, 4),
);

/// A call the fake received.
typedef TopUpCall = ({
  String command,
  String? operatorId,
  String? phoneDigits,
  int? amountCents,
  String? pin,
  String? idempotencyKey,
  String? topUpId,
});

/// Top-ups without the API: records every call and answers with what the
/// test set, by default the three operators and a top-up done.
class FakeTopUpRepository implements TopUpRepository {
  /// What the next reads of the operators do.
  Future<List<TopUpOperator>> Function() operatorsAnswer = () async =>
      topUpOperators;

  /// What the next top-ups do.
  Future<TopUp> Function() createAnswer = () async => topUpDone();

  /// What the next reads of a receipt do.
  Future<TopUp> Function() fetchAnswer = () async => topUpDone();

  final List<TopUpCall> _calls = [];

  /// The calls of [command], in order.
  List<TopUpCall> callsOf(String command) =>
      _calls.where((call) => call.command == command).toList();

  @override
  Future<List<TopUpOperator>> operators() {
    _record('operators');
    return operatorsAnswer();
  }

  @override
  Future<TopUp> create({
    required String operatorId,
    required String phoneDigits,
    required int amountCents,
    required String pin,
    required String idempotencyKey,
  }) {
    _record(
      'create',
      operatorId: operatorId,
      phoneDigits: phoneDigits,
      amountCents: amountCents,
      pin: pin,
      idempotencyKey: idempotencyKey,
    );
    return createAnswer();
  }

  @override
  Future<TopUp> fetch(String topUpId) {
    _record('fetch', topUpId: topUpId);
    return fetchAnswer();
  }

  void _record(
    String command, {
    String? operatorId,
    String? phoneDigits,
    int? amountCents,
    String? pin,
    String? idempotencyKey,
    String? topUpId,
  }) => _calls.add((
    command: command,
    operatorId: operatorId,
    phoneDigits: phoneDigits,
    amountCents: amountCents,
    pin: pin,
    idempotencyKey: idempotencyKey,
    topUpId: topUpId,
  ));
}
