import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// Screens lay their content out in lists; the components must keep their
/// own semantics there.
Widget inAList(Widget child) => MaterialApp(
  theme: NbTheme.dark(),
  home: Scaffold(
    body: ListView(
      children: [
        Column(children: [const Text('Antes'), child, const Text('Depois')]),
      ],
    ),
  ),
);

// Found while building the Home (brief, section 8): without its own
// semantics node, a heading or an error merged with every text around it,
// so a screen reader treated the whole block as a heading, or announced
// the whole block when the error appeared.
void main() {
  testWidgets('DisplayTitle is a heading of its own text only', (tester) async {
    await tester.pumpWidget(
      inAList(const DisplayTitle(lead: 'Seu dinheiro,', trail: 'um passo.')),
    );

    expect(
      tester.getSemantics(find.byType(DisplayTitle)),
      isSemantics(label: 'Seu dinheiro,\num passo.', isHeader: true),
    );
  });

  testWidgets('FormErrorText announces only the error', (tester) async {
    await tester.pumpWidget(inAList(const FormErrorText('CPF inválido.')));

    expect(
      tester.getSemantics(find.byType(FormErrorText)),
      isSemantics(label: 'CPF inválido.', isLiveRegion: true),
    );
  });
}
