import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';

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

  @override
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Semantics(
      button: true,
      label: '$category, $date. $preview. $unread não lidas',
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
                            style: NbType.bodyStrong.copyWith(
                              color: colors.text,
                            ),
                          ),
                        ),
                        const SizedBox(width: NbSpace.sm),
                        Text(
                          date,
                          style: NbType.caption.copyWith(
                            color: colors.textMuted,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            preview,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: NbType.caption.copyWith(
                              color: colors.textMuted,
                            ),
                          ),
                        ),
                        const SizedBox(width: NbSpace.sm),
                        _UnreadBadge(count: unread),
                      ],
                    ),
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
  Widget build(BuildContext context) {
    final colors = context.nbColors;

    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(color: colors.surface2, shape: BoxShape.circle),
      child: Icon(icon, size: NbSize.icon, color: colors.accent),
    );
  }
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
        style: NbType.cardLabel.copyWith(color: colors.onPrimary),
      ),
    );
  }
}
