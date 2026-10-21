import 'package:design_system/design_system.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:next_bank/core/ui/common_copy.dart';

/// D7, revised (v1.1.0 plan, task 6): the "Exemplo" tag inside [block], the
/// widget that shows a made-up figure on a layout-only screen.
Finder exampleTagIn(Finder block) => find.descendant(
  of: block,
  matching: find.widgetWithText(NbTag, CommonCopy.example),
);

/// The nearest [T] above the widget [of]: the block a figure sits in.
Finder blockOf<T>(Finder of) =>
    find.ancestor(of: of, matching: find.byType(T)).first;
