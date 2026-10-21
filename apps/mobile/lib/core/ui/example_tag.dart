import 'package:design_system/design_system.dart';
import 'package:flutter/widgets.dart';
import 'package:next_bank/core/ui/common_copy.dart';

/// Says a figure is made up (D7, revised in the v1.1.0 plan, task 6): a
/// layout-only screen may show one only beside this tag. Real figures come
/// from the server and never carry it.
class ExampleTag extends StatelessWidget {
  /// Creates the tag.
  const new({super.key});

  @override
  Widget build(BuildContext context) =>
      const NbTag(label: CommonCopy.example, tone: NbTagTone.outlined);
}
