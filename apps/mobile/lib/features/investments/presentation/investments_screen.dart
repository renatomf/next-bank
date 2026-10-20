import 'package:design_system/design_system.dart';
import 'package:flutter/material.dart';
import 'package:next_bank/features/investments/presentation/invest_tab.dart';
import 'package:next_bank/features/investments/presentation/more_tab.dart';
import 'package:next_bank/features/investments/presentation/returns_tab.dart';

/// Investimentos (v1.1.0 plan, task 4.16), a destination of the bar, layout
/// only for now: the Rentabilidade, Investir and Mais tabs.
class InvestmentsScreen extends StatefulWidget {
  /// Creates the screen.
  const new({super.key});

  @override
  State<InvestmentsScreen> createState() => _InvestmentsScreenState();
}

class _InvestmentsScreenState extends State<InvestmentsScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabs = TabController(length: 3, vsync: this);

  @override
  void dispose() {
    _tabs.dispose();
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
              Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        'Investimentos',
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                    ),
                  ),
                  NbIconButton(
                    icon: Icons.visibility_off_outlined,
                    label: 'Ocultar valores',
                    onPressed: () => showNbToast(
                      context,
                      'Em breve.',
                      icon: Icons.info_outline,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: NbSpace.lg),
              NbTabBar(
                controller: _tabs,
                labels: const ['Rentabilidade', 'Investir', 'Mais'],
              ),
              const SizedBox(height: NbSpace.xl),
              // The tabs switch the content below them; the whole screen
              // scrolls as one list.
              ListenableBuilder(
                listenable: _tabs,
                builder: (_, _) => switch (_tabs.index) {
                  0 => const ReturnsTab(),
                  1 => const InvestTab(),
                  _ => const MoreTab(),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
