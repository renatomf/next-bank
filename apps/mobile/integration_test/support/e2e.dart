import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/api_config.dart';

// The demo accounts the seed creates (apps/api/scripts/seed-demo.ts):
// fictitious people, data and passwords, public on purpose.
const String anaEmail = 'ana.demo@example.com';
const String anaPassword = 'demo-ana-next-bank';
const String anaPin = '2580';
const String brunoEmail = 'bruno.demo@example.com';
const String brunoPassword = 'demo-bruno-next-bank';
const String brunoCpf = '52998224725';

/// Pumps until [finder] shows, failing after [timeout]: the API answers in
/// its own time, so no fixed wait.
Future<void> waitFor(
  WidgetTester tester,
  Finder finder, {
  Duration timeout = const Duration(seconds: 30),
}) async {
  final end = DateTime.now().add(timeout);
  while (finder.evaluate().isEmpty) {
    if (DateTime.now().isAfter(end)) {
      throw TestFailure('Timed out waiting for $finder');
    }
    await tester.pump(const Duration(milliseconds: 200));
  }
  await tester.pumpAndSettle();
}

/// Scrolls the list of the screen [type] until [finder] shows, and taps it.
Future<void> scrollAndTap(WidgetTester tester, Type type, Finder finder) async {
  // The real keyboard covers the bottom of the screen: close it first.
  FocusManager.instance.primaryFocus?.unfocus();
  await tester.pumpAndSettle();
  await tester.scrollUntilVisible(
    finder,
    200,
    scrollable: find
        .descendant(of: find.byType(type), matching: find.byType(Scrollable))
        .first,
  );
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// From the first screen, signed in with the password, on the Home. A
/// session left by an earlier run opens on the Unlock screen: it is left.
Future<void> signIn(
  WidgetTester tester, {
  required String email,
  required String password,
}) async {
  // Waits for one of the two screens by what only it has: the login's
  // "Entrar" or the Unlock screen's "Entrar com outra conta". Any FilledButton
  // would do neither: the Unlock screen's "Acessar conta" is one too, and it
  // shows a frame before its link, so the login seemed open when it was not.
  await waitFor(
    tester,
    find.byWidgetPredicate(
      (widget) =>
          widget is Text &&
          (widget.data == 'Entrar' || widget.data == 'Entrar com outra conta'),
    ),
  );
  if (find.text('Entrar com outra conta').evaluate().isNotEmpty) {
    await tester.tap(find.text('Entrar com outra conta'));
  }
  // On the CI emulator the login was seen to go away between filling it and
  // tapping "Entrar" (PR #163, twice, with a session left by the test
  // before): it is filled and tapped only once it stays, a few times at
  // most, and a failure says what was on screen instead.
  final button = find.widgetWithText(FilledButton, 'Entrar');
  for (var attempt = 0; attempt < 3; attempt++) {
    await waitFor(tester, button);
    await tester.enterText(find.byType(TextField).at(0), email);
    await tester.enterText(find.byType(TextField).at(1), password);
    await tester.pumpAndSettle();
    if (button.evaluate().isEmpty) continue;
    // Login with the password goes straight to the Home (week 6 plan, D5).
    await tester.tap(button);
    await waitFor(tester, find.bySemanticsLabel('Área Pix'));
    return;
  }
  throw TestFailure('The login did not stay on screen: ${textsOnScreen()}');
}

/// Every text on screen, to tell what showed when a step failed.
List<String> textsOnScreen() => [
  for (final element in find.byType(Text).evaluate())
    if ((element.widget as Text).data case final String text) text,
];

/// The random key of the customer [email], straight from the API, as the
/// "Receber" screen asks for it (v1.1.0 plan, task 3).
Future<String> receivingKeyOf(String email, String password) async {
  final client = HttpClient();
  try {
    final login = await _postJson(client, '/v1/auth/login', null, {
      'email': email,
      'password': password,
    });
    final token = login['accessToken']! as String;
    final key = await _postJson(
      client,
      '/v1/me/pix/receiving-key',
      token,
      null,
    );
    return key['key']! as String;
  } finally {
    client.close();
  }
}

Future<Map<String, Object?>> _postJson(
  HttpClient client,
  String path,
  String? token,
  Map<String, Object?>? body,
) async {
  final request = await client.postUrl(apiBaseUrl.resolve(path));
  if (token != null) request.headers.set('authorization', 'Bearer $token');
  if (body != null) {
    request.headers.contentType = ContentType.json;
    request.write(jsonEncode(body));
  }
  final response = await request.close();
  final text = await response.transform(utf8.decoder).join();
  if (response.statusCode != 200) {
    throw TestFailure('POST $path answered ${response.statusCode}');
  }
  return jsonDecode(text) as Map<String, Object?>;
}
