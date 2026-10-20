import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/notifications/presentation/settings/notification_group.dart';

/// "Configurar notificações" (v1.1.0 plan, task 4.6), layout only for now:
/// the kinds of notification in three tabs, each with a switch per
/// channel.
class NotificationSettingsScreen extends StatefulWidget {
  /// Creates the screen; the router says where back goes.
  const new({required this.onBack, super.key});

  /// Leaves the screen.
  final VoidCallback onBack;

  @override
  State<NotificationSettingsScreen> createState() =>
      _NotificationSettingsScreenState();
}

/// The groups of each tab, in order: Transacionais, Produtos and Outros.
const List<List<NotificationGroup>> _tabs = [
  [
    NotificationGroup(
      title: 'Pix e transferências',
      description:
          'Avisos de Pix recebidos e enviados. As notificações ajudam na '
          'prevenção de fraudes.',
      channels: _appOnly,
      isOn: true,
    ),
    NotificationGroup(
      title: 'Pagamentos',
      description:
          'Pagamentos feitos com QR Code. As notificações ajudam na '
          'prevenção de fraudes.',
      channels: _appOnly,
      isOn: true,
    ),
    NotificationGroup(
      title: 'Segurança',
      description: 'Novos acessos à sua conta e trocas de senha ou PIN.',
      channels: _appOnly,
      isOn: true,
    ),
  ],
  [
    NotificationGroup(
      title: 'Novidades do next bank',
      description: 'Novos produtos, serviços e atualizações do app.',
      channels: _appAndEmail,
      isOn: true,
    ),
    NotificationGroup(
      title: 'Recarga',
      description: 'Ofertas e avisos de recarga de celular.',
      channels: _appAndEmail,
      isOn: false,
    ),
  ],
  [
    NotificationGroup(
      title: 'Pesquisas',
      description: 'Pesquisas de satisfação para você dar a sua opinião.',
      channels: _appAndEmail,
      isOn: false,
    ),
    NotificationGroup(
      title: 'Avisos',
      description:
          'Horários de atendimento em feriados, mudanças em datas de '
          'pagamento e mais.',
      channels: _appAndEmail,
      isOn: true,
    ),
  ],
];

const List<String> _appOnly = ['Notificações no aplicativo'];
const List<String> _appAndEmail = ['Notificações no aplicativo', 'E-mail'];

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController = TabController(
    length: _tabs.length,
    vsync: this,
  );

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GlowBackground(
        child: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(NbSpace.screen),
            children: [
              ScreenHeader(
                title: 'Configurar notificações',
                icon: Icons.arrow_back,
                iconLabel: 'Voltar',
                onPressed: widget.onBack,
              ),
              const SizedBox(height: NbSpace.xl),
              NbTabBar(
                controller: _tabController,
                labels: const ['Transacionais', 'Produtos', 'Outros'],
              ),
              const SizedBox(height: NbSpace.xl),
              // The tabs switch the groups below them; the whole screen
              // scrolls as one list.
              ListenableBuilder(
                listenable: _tabController,
                builder: (context, _) => Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    for (final (index, group)
                        in _tabs[_tabController.index].indexed) ...[
                      if (index > 0)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: NbSpace.lg),
                          child: Divider(),
                        ),
                      group,
                    ],
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
