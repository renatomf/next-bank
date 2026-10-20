import 'package:flutter/material.dart';

/// One example account in Pix Automático, shown while it has no backend.
typedef ExampleAutomaticPayment = ({
  IconData icon,
  String company,
  String description,

  /// The amount, or what it waits for when the bill varies.
  String amount,
  String frequency,
  String minimum,
});

/// The examples the screen lists (v1.1.0 plan, task 4.7): made-up
/// companies, no real data. They go away when Pix Automático comes from
/// the server.
const List<ExampleAutomaticPayment> exampleAutomaticPayments = [
  (
    icon: Icons.live_tv_outlined,
    company: 'Streaming Exemplo Ltda.',
    description: 'Plano mensal',
    amount: r'R$ 39,90',
    frequency: 'Mensal',
    minimum: r'R$ 39,90',
  ),
  (
    icon: Icons.bolt_outlined,
    company: 'Energia Modelo S.A.',
    description: 'Conta de luz',
    amount: 'Aguardando a conta fechar',
    frequency: 'Mensal',
    minimum: r'R$ 50,00',
  ),
  (
    icon: Icons.fitness_center_outlined,
    company: 'Academia Fictícia Ltda.',
    description: 'Mensalidade',
    amount: r'R$ 89,90',
    frequency: 'Mensal',
    minimum: r'R$ 89,90',
  ),
];
