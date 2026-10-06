import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:next_bank/features/home/presentation/home_screen.dart';

void main() {
  runApp(const ProviderScope(child: NextBankApp()));
}

/// Root of the next bank app.
class NextBankApp extends StatelessWidget {
  /// Creates the app root.
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(title: 'next bank', home: HomeScreen());
  }
}
