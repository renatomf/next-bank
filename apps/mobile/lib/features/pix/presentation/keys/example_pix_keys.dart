import 'package:flutter/material.dart';

/// One example Pix key, shown while the keys have no backend.
typedef ExamplePixKey = ({IconData icon, String type, String value});

/// How many keys an account may have, shown as "2 de 5".
const int pixKeyLimit = 5;

/// The customer's registered keys (v1.1.0 plan, task 4.8): made up, the
/// random key of low entropy so no scanner takes it for a secret. They go
/// away when the keys come from the server.
const List<ExamplePixKey> exampleRegisteredKeys = [
  (
    icon: Icons.key_outlined,
    type: 'Chave aleatória',
    value: '11111111-2222-4333-8444-555555555555',
  ),
  (
    icon: Icons.smartphone_outlined,
    type: 'Celular',
    value: '+55 (11) 90000-0000',
  ),
];

/// A made-up e-mail to suggest registering.
const ExamplePixKey exampleEmailKey = (
  icon: Icons.mail_outline,
  type: 'E-mail',
  value: 'cliente@exemplo.com',
);

/// A new random key to suggest registering.
const ExamplePixKey exampleRandomKey = (
  icon: Icons.key_outlined,
  type: 'Chave aleatória',
  value: 'Chave Pix gerada automaticamente',
);
