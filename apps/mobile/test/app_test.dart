import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/main.dart';

void main() {
  testWidgets('opens the app showing the next bank name', (tester) async {
    await tester.pumpWidget(const NextBankApp());

    expect(find.text('next bank'), findsOneWidget);
  });
}
