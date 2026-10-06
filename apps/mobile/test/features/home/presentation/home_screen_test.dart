import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/features/home/domain/api_status.dart';
import 'package:next_bank/features/home/presentation/api_status_provider.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

import 'api_status_provider_test.dart';

class _PendingRepository implements ApiStatusRepository {
  final completer = Completer<ApiStatus>();

  @override
  Future<ApiStatus> check() => completer.future;
}

Future<void> pumpHome(WidgetTester tester, ApiStatusRepository repository) {
  return tester.pumpWidget(
    ProviderScope(
      overrides: [apiStatusRepositoryProvider.overrideWithValue(repository)],
      child: const MaterialApp(home: HomeScreen()),
    ),
  );
}

void main() {
  testWidgets('shows progress while checking', (tester) async {
    final repository = _PendingRepository();
    await pumpHome(tester, repository);

    expect(find.bySemanticsLabel('Verificando a API'), findsOneWidget);

    repository.completer.complete(ApiStatus.available);
    await tester.pumpAndSettle();
  });

  testWidgets('shows that the API is available', (tester) async {
    await pumpHome(tester, FakeApiStatusRepository(ApiStatus.available));
    await tester.pumpAndSettle();

    expect(find.text('API disponível'), findsOneWidget);
    expect(find.text('Tentar novamente'), findsNothing);
  });

  testWidgets('shows unavailable and checks again on retry', (tester) async {
    final repository = FakeApiStatusRepository(ApiStatus.unavailable);
    await pumpHome(tester, repository);
    await tester.pumpAndSettle();

    expect(find.text('API indisponível'), findsOneWidget);

    repository.status = ApiStatus.available;
    await tester.tap(find.widgetWithText(FilledButton, 'Tentar novamente'));
    await tester.pumpAndSettle();

    expect(find.text('API disponível'), findsOneWidget);
    expect(repository.calls, 2);
  });
}
