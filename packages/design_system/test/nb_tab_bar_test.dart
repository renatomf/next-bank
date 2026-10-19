import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

// The app's tabs (v1.1.0 plan, tasks 4.4 and 4.6): the labels, the accent
// line under the one that is on.
void main() {
  testWidgets('shows the labels and switches the controller', (tester) async {
    final controller = TabController(length: 2, vsync: const TestVSync());
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: NbTabBar(controller: controller, labels: const ['Um', 'Dois']),
        ),
      ),
    );

    await tester.tap(find.text('Dois'));
    await tester.pumpAndSettle();

    expect(controller.index, 1);
    final bar = tester.widget<TabBar>(find.byType(TabBar));
    expect(bar.indicatorColor, NbColors.dark.accent);
  });

  // S21 checkpoint: the labels use the room well and fit a small phone with
  // large text on one line each, whole.
  testWidgets('fits long labels on one line on a small phone at 1.3x', (
    tester,
  ) async {
    tester.view
      ..physicalSize = const Size(320 * 3, 568 * 3)
      ..devicePixelRatio = 3;
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.view.reset);
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    final controller = TabController(length: 3, vsync: const TestVSync());
    addTearDown(controller.dispose);
    const labels = ['Transacionais', 'Produtos', 'Outros'];

    await tester.pumpWidget(
      MaterialApp(
        theme: NbTheme.dark(),
        home: Scaffold(
          body: Padding(
            padding: const EdgeInsets.symmetric(horizontal: NbSpace.screen),
            child: NbTabBar(controller: controller, labels: labels),
          ),
        ),
      ),
    );

    expect(tester.takeException(), isNull);
    for (final label in labels) {
      final paragraph = tester.renderObject<RenderParagraph>(find.text(label));
      expect(paragraph.didExceedMaxLines, isFalse, reason: label);
      final boxes = paragraph.getBoxesForSelection(
        TextSelection(baseOffset: 0, extentOffset: label.length),
      );
      expect(boxes.map((box) => box.top).toSet(), hasLength(1), reason: label);
      expect(paragraph.size.width, greaterThanOrEqualTo(boxes.last.right));
    }
  });
}
