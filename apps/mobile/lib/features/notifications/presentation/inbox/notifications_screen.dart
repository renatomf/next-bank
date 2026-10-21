import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/core/clock.dart';
import 'package:next_bank/core/date_texts.dart';
import 'package:next_bank/features/notifications/presentation/example_notifications.dart';
import 'package:next_bank/features/notifications/presentation/inbox/notification_tile.dart';

/// Notifications (v1.1.0 plan, task 4.6), layout only for now: the example
/// notifications, twelve at a time, a day back every two rows, and
/// "Carregar mais" for twelve more (S21 checkpoint). Each row says it is
/// coming.
class NotificationsScreen extends ConsumerStatefulWidget {
  /// Creates the screen; the router says where back and the gear go.
  const new({required this.onBack, required this.onSettings, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  /// Opens the notification settings.
  final VoidCallback onSettings;

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  static const int _pageSize = 12;

  int _shown = _pageSize;

  @override
  Widget build(BuildContext context) {
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
                  onPressed: widget.onBack,
                  action: IconCircleButton(
                    icon: Icons.settings_outlined,
                    label: 'Configurar notificações',
                    onPressed: widget.onSettings,
                  ),
                ),
              ),
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(
                    horizontal: NbSpace.screen,
                  ),
                  // The rows shown, then the button for more.
                  itemCount: _shown + 1,
                  itemBuilder: (context, index) {
                    if (index == _shown) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(
                          vertical: NbSpace.lg,
                        ),
                        child: TextButton(
                          onPressed: () => setState(() => _shown += _pageSize),
                          child: const Text('Carregar mais'),
                        ),
                      );
                    }
                    final example =
                        exampleNotifications[index %
                            exampleNotifications.length];
                    final day = today.subtract(Duration(days: index ~/ 2));
                    return Column(
                      children: [
                        if (index > 0) const Divider(),
                        NotificationTile(
                          icon: example.icon,
                          category: example.category,
                          preview: example.preview,
                          date: '${day.day} ${shortMonth(day.month)}',
                          unread: example.unread,
                          madeUpFigure: example.madeUpFigure,
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
