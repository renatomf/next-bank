import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/home/domain/api_status.dart';
import 'package:next_bank/features/home/presentation/api_status_provider.dart';
import 'package:next_bank/main.dart';

import 'features/home/presentation/api_status_provider_test.dart';

void main() {
  testWidgets('opens the app showing the next bank name', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          apiStatusRepositoryProvider.overrideWithValue(
            FakeApiStatusRepository(ApiStatus.available),
          ),
        ],
        child: const NextBankApp(),
      ),
    );

    expect(find.text('next bank'), findsOneWidget);
  });
}
