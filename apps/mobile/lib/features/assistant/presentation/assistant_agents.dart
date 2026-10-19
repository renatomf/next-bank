import 'package:flutter/material.dart';

/// One of the assistant's agents: what it helps with.
typedef AssistantAgent = ({IconData icon, String name, String description});

/// The agents the assistant offers (v1.1.0 plan, task 4.10), shown on its
/// screen and in "Escolher agente". None works yet: they say they are
/// coming. No card agent: next bank has no credit card yet.
const List<AssistantAgent> assistantAgents = [
  (
    icon: Icons.help_outline,
    name: 'Pedir ajuda',
    description:
        'Agente para responder dúvidas de produtos e resolver problemas.',
  ),
  (
    icon: Icons.payments_outlined,
    name: 'Fazer transações',
    description: 'Agente para ajudar você a fazer Pix e pagar com QR Code.',
  ),
  (
    icon: Icons.receipt_long_outlined,
    name: 'Analisar extrato de conta',
    description:
        'Agente para filtrar os gastos do seu extrato e criar resumos.',
  ),
];
