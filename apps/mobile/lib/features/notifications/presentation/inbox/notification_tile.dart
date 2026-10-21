import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/core/ui/common_copy.dart';
import 'package:next_bank/core/ui/example_tag.dart';

/// One notification: its icon in a circle, the category and the date, the
/// preview in up to two lines and how many are unread. Read by screen
/// readers as one sentence.
class NotificationTile extends StatelessWidget {
  /// Creates the row.
  const new({
    required this.icon,
    required this.category,
    required this.preview,
    required this.date,
    required this.unread,
    required this.onTap,
    this.madeUpFigure = false,
    super.key,
  });

  /// What the notification is about.
  final IconData icon;

  /// Its category, such as "Pix e transferências".
  final String category;

  /// The start of its text.
  final String preview;

  /// When it arrived, such as "19 out".
  final String date;

  /// How many of the category are unread.
  final int unread;

  /// Called on tap.
  final VoidCallback onTap;

  /// Whether [preview] cites a made-up figure: the tag says so (D7, revised
  /// in the v1.1.0 plan, task 6).
  final bool madeUpFigure;

  @override
  Widget build(BuildContext context) {
    final example = madeUpFigure ? ' ${CommonCopy.example}.' : '';

    return Semantics(
      button: true,
      label: '$category, $date. $preview.$example $unread não lidas',
      onTap: onTap,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: NbSpace.lg),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _IconCircle(icon: icon),
              const SizedBox(width: NbSpace.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  spacing: NbSpace.xs,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            category,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.nbText.bodyStrong,
                          ),
                        ),
                        const SizedBox(width: NbSpace.sm),
                        Text(date, style: context.nbText.caption),
                      ],
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            preview,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: context.nbText.caption,
                          ),
                        ),
                        const SizedBox(width: NbSpace.sm),
                        _UnreadBadge(count: unread),
                      ],
                    ),
                    // On its own line: beside the category and the date it
                    // does not fit a small phone at 1.3x text.
                    if (madeUpFigure) const ExampleTag(),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _IconCircle extends StatelessWidget {
  const new({required this.icon});

  final IconData icon;

  @override
  Widget build(BuildContext context) =>
      NbIconCircle(icon: icon, size: NbSize.avatar);
}

class _UnreadBadge extends StatelessWidget {
  const new({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Container(
      constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
      padding: const EdgeInsets.symmetric(horizontal: NbSpace.xs),
      alignment: Alignment.center,
      decoration: BoxDecoration(color: colors.primary, shape: BoxShape.circle),
      child: Text(
        '$count',
        style: context.nbText.cardLabel.copyWith(color: colors.onPrimary),
      ),
    );
  }
}
