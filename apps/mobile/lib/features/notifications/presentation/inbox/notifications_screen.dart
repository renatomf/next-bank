import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/date_texts.dart';
import 'package:next_bank/features/notifications/presentation/example_notifications.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notification_tile.dart';

/// Notifications (v1.1.0 plan, task 4.6), layout only for now: the example
/// notifications repeated without end, a day back every two rows, as a
/// list that pages forever would show. Each row says it is coming.
class NotificationsScreen extends ConsumerWidget {
  /// Creates the screen; the router says where back and the gear go.
  const new({required this.onBack, required this.onSettings, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  /// Opens the notification settings.
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.nbColors;
    final today = ref.watch(nowProvider)();

    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(NbSpace.screen),
                child: ScreenHeader(
                  title: 'Notificações',
                  icon: Icons.arrow_back,
                  iconLabel: 'Voltar',
                  onPressed: onBack,
                  action: IconCircleButton(
                    icon: Icons.settings_outlined,
                    label: 'Configurar notificações',
                    onPressed: onSettings,
                  ),
                ),
              ),
              Expanded(
                // No item count: the list builds rows as it scrolls, without
                // end.
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(
                    horizontal: NbSpace.screen,
                  ),
                  itemBuilder: (context, index) {
                    final example =
                        exampleNotifications[index %
                            exampleNotifications.length];
                    final day = today.subtract(Duration(days: index ~/ 2));
                    return Column(
                      children: [
                        if (index > 0) Divider(height: 1, color: colors.border),
                        NotificationTile(
                          icon: example.icon,
                          category: example.category,
                          preview: example.preview,
                          date: '${day.day} ${shortMonth(day.month)}',
                          unread: example.unread,
                          onTap: () => showNbToast(
                            context,
                            'Em breve.',
                            icon: Icons.info_outline,
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
