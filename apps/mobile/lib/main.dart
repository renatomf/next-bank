import 'package:flutter/material.dart';

void main() {
  runApp(const NextBankApp());
}

/// Root of the next bank app.
class NextBankApp extends StatelessWidget {
  /// Creates the app root.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      title: 'next bank',
      home: Scaffold(body: Center(child: Text('next bank'))),
    );
  }
}
