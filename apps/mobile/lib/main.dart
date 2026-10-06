import 'package:flutter/material.dart';

void main() {
  runApp(const NextBankApp());
}

/// Raiz do app next bank.
class NextBankApp extends StatelessWidget {
  const NextBankApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'next bank',
      home: Scaffold(body: Center(child: Text('next bank'))),
    );
  }
}
