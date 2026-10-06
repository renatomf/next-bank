import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/main.dart';

void main() {
  testWidgets('abre o app exibindo o nome next bank', (tester) async {
    await tester.pumpWidget(const NextBankApp());

    expect(find.text('next bank'), findsOneWidget);
  });
}
