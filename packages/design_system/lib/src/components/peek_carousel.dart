import 'package:design_system/src/tokens.dart';
import 'package:flutter/material.dart';

/// Items side by side, swiped one at a time; the next shows cut at the
/// edge, so the row reads as something to swipe (v1.1.0 plan, tasks 4.14
/// and 4.15). The first item rests on the start edge.
class PeekCarousel extends StatefulWidget {
  /// Creates the carousel.
  const new({
    required this.children,
    required this.itemAspectRatio,
    required this.onPageChanged,
    this.initialPage = 0,
    super.key,
  });

  /// The items, in order.
  final List<Widget> children;

  /// Each item's width over its height, such as a card's.
  final double itemAspectRatio;

  /// Called with the index of the item swiped in.
  final ValueChanged<int> onPageChanged;

  /// The item on at first.
  final int initialPage;

  @override
  State<PeekCarousel> createState() => _PeekCarouselState();
}

class _PeekCarouselState extends State<PeekCarousel> {
  /// Each item takes most of the width, leaving room for the next one.
  static const double _itemShare = 0.86;

  late final PageController _pages = PageController(
    viewportFraction: _itemShare,
    initialPage: widget.initialPage,
  );

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // As tall as one item in its share of the width.
    return AspectRatio(
      aspectRatio: widget.itemAspectRatio / _itemShare,
      child: PageView(
        controller: _pages,
        padEnds: false,
        onPageChanged: widget.onPageChanged,
        children: [
          for (final child in widget.children)
            Padding(
              padding: const EdgeInsets.only(right: NbSpace.md),
              child: child,
            ),
        ],
      ),
    );
  }
}
